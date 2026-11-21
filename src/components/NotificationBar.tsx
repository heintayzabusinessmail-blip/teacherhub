import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Mail,
  Megaphone,
  Plus,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { formatLocalDateTime } from '../utils/helpers';
import { publishAdminNotice } from '../utils/notifications';
import {
  ensureNotificationAudioUnlocked,
  isNotificationSoundEnabled,
  playNotificationChime,
  setNotificationSoundEnabled,
} from '../utils/notificationSound';
import type { HubNotification, NavTab } from '../types';

interface NotificationBarProps {
  onSelectTab: (tab: NavTab) => void;
}

function formatNotifTime(n: HubNotification): string {
  const dt = n.createdAt?.toDate?.();
  if (!dt) return 'Just now';
  return formatLocalDateTime(dt.toISOString());
}

export function NotificationBar({ onSelectTab }: NotificationBarProps) {
  const {
    user,
    isAdmin,
    myProfile,
    notifications,
    allowlist,
    queueEmailConfirmation,
  } = useHub();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminDrawerTab, setAdminDrawerTab] = useState<'alerts' | 'notices'>('alerts');
  const [showComposer, setShowComposer] = useState(false);

  // Notification sound + live floating big toast
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isNotificationSoundEnabled());
  const [liveToast, setLiveToast] = useState<HubNotification | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Admin notice composer state
  const [nTitle, setNTitle] = useState('');
  const [nMessage, setNMessage] = useState('');
  const [nAudience, setNAudience] = useState<'all' | 'teachers'>('all');
  const [nPriority, setNPriority] = useState<'important' | 'normal'>('important');
  const [nTargetTab, setNTargetTab] = useState<NavTab | ''>('');
  const [extraRecipientsText, setExtraRecipientsText] = useState('');
  const [includeSelfCopy, setIncludeSelfCopy] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Locally tracked seen notice IDs for non-admin users (works for both Teachers and View-Only)
  const storageKey = user ? `yao_seen_notifs_${user.uid}` : 'yao_seen_notifs_guest';
  const [seenIds, setSeenIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    ensureNotificationAudioUnlocked();
  }, []);

  const markLocalSeen = (ids: string[]) => {
    setSeenIds((prev) => {
      const merged = Array.from(new Set([...prev, ...ids])).slice(-150);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch {
        // ignore storage errors
      }
      return merged;
    });
  };

  // Partition notifications by role
  const teacherAlertsForAdmin = useMemo(
    () => notifications.filter((n) => n.audience === 'admin'),
    [notifications]
  );

  const unreadAdminAlerts = useMemo(
    () => teacherAlertsForAdmin.filter((n) => !n.readByAdmin),
    [teacherAlertsForAdmin]
  );

  const publicNotices = useMemo(
    () => notifications.filter((n) => n.audience === 'all' || n.audience === 'teachers'),
    [notifications]
  );

  const unreadNoticesForUser = useMemo(
    () => publicNotices.filter((n) => !seenIds.includes(n.id)),
    [publicNotices, seenIds]
  );

  const latestImportantNotice = useMemo(
    () => publicNotices.find((n) => n.priority === 'important') || publicNotices[0] || null,
    [publicNotices]
  );

  const latestAdminAlert = unreadAdminAlerts[0] || teacherAlertsForAdmin[0] || null;

  // Detect brand-new incoming notifications in real time -> play chime + pop BIG toast alert!
  const relevantLiveFeed = isAdmin ? teacherAlertsForAdmin : publicNotices;

  useEffect(() => {
    if (!initializedRef.current) {
      relevantLiveFeed.forEach((n) => knownIdsRef.current.add(n.id));
      if (notifications.length > 0) {
        initializedRef.current = true;
      }
      // Mark initialized after initial snapshot settles even if collection is empty
      const timer = setTimeout(() => {
        initializedRef.current = true;
      }, 1500);
      return () => clearTimeout(timer);
    }

    const brandNew = relevantLiveFeed.filter(
      (n) => !knownIdsRef.current.has(n.id) && n.actorUid !== user?.uid
    );
    relevantLiveFeed.forEach((n) => knownIdsRef.current.add(n.id));

    if (brandNew.length > 0) {
      const newest = brandNew[0];
      setLiveToast(newest);
      if (soundEnabled) {
        playNotificationChime(newest.priority === 'important');
      }
    }
  }, [relevantLiveFeed, notifications.length, soundEnabled, user?.uid]);

  // Auto-hide floating toast after 14 seconds (stays visible in top banner regardless)
  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => setLiveToast(null), 14000);
    return () => clearTimeout(timer);
  }, [liveToast]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playNotificationChime(true);
    }
  };

  const handleMarkAlertRead = async (n: HubNotification) => {
    if (!isAdmin || n.readByAdmin) return;
    try {
      await updateDoc(doc(db, 'notifications', n.id), {
        readByAdmin: true,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${n.id}`);
    }
  };

  const handleMarkAllAdminRead = async () => {
    if (!isAdmin || unreadAdminAlerts.length === 0) return;
    try {
      await Promise.all(
        unreadAdminAlerts.map((n) =>
          updateDoc(doc(db, 'notifications', n.id), { readByAdmin: true })
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications/markAllRead');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const getRegisteredEmailsForAudience = (
    audience: 'all' | 'teachers',
    extraRaw = '',
    withSelfCopy = false
  ): string[] => {
    const myEmail = (user?.email || '').trim().toLowerCase();
    const collected = new Set<string>();

    allowlist.forEach((entry) => {
      if (entry.isSample || !entry.email || !entry.email.includes('@')) return;
      const matches =
        audience === 'teachers'
          ? entry.role === 'teacher'
          : entry.role === 'teacher' || entry.role === 'viewer' || entry.role === 'admin';
      if (matches) {
        collected.add(entry.email.trim().toLowerCase());
      }
    });

    if (extraRaw.trim()) {
      extraRaw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@') && e.includes('.'))
        .forEach((e) => collected.add(e));
    }

    if (withSelfCopy && myEmail.includes('@')) {
      collected.add(myEmail);
    } else if (!withSelfCopy && myEmail) {
      collected.delete(myEmail);
    }

    return Array.from(collected);
  };

  const composerRecipients = useMemo(
    () => getRegisteredEmailsForAudience(nAudience, extraRecipientsText, includeSelfCopy),
    [allowlist, user?.email, nAudience, extraRecipientsText, includeSelfCopy]
  );

  const openNoticeEmailPrompt = (
    title: string,
    message: string,
    audience: 'all' | 'teachers',
    priority: 'important' | 'normal',
    explicitRecipients?: string[]
  ) => {
    const recipients = explicitRecipients ?? getRegisteredEmailsForAudience(audience);
    if (recipients.length === 0) return;
    const prefix = priority === 'important' ? '[YAO Important Notice]' : '[YAO Hub Notice]';
    const senderName = myProfile?.displayName || user?.displayName || 'Tr Hein Tay Za';
    queueEmailConfirmation({
      heading: `Open in Email App (${recipients.length} recipient${recipients.length === 1 ? '' : 's'})`,
      recipients,
      subject: `${prefix} ${title.trim()}`,
      bodyText: `${message.trim()}\n\n— ${senderName} (YAO English Teacher Hub)`,
      senderLabel: `From ${senderName}`,
    });
  };

  const handlePublishNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin || !nTitle.trim() || !nMessage.trim()) return;
    setPublishing(true);
    const savedTitle = nTitle.trim();
    const savedMessage = nMessage.trim();
    const savedAudience = nAudience;
    const savedPriority = nPriority;
    try {
      await publishAdminNotice({
        actorUid: user.uid,
        actorName: myProfile?.displayName || user.displayName || 'Tr Hein Tay Za',
        audience: savedAudience,
        priority: savedPriority,
        title: savedTitle,
        message: savedMessage,
        targetTab: nTargetTab,
      });
      if (soundEnabled) {
        playNotificationChime(false);
      }
      setNTitle('');
      setNMessage('');
      setNTargetTab('');
      setExtraRecipientsText('');
      setIncludeSelfCopy(false);
      setShowComposer(false);
      setAdminDrawerTab('notices');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    } finally {
      setPublishing(false);
    }
  };

  const handleJump = (n: HubNotification) => {
    if (isAdmin && n.audience === 'admin' && !n.readByAdmin) {
      handleMarkAlertRead(n);
    } else if (!isAdmin) {
      markLocalSeen([n.id]);
    }
    if (n.targetTab) {
      onSelectTab(n.targetTab as NavTab);
    }
    setLiveToast(null);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* BIG LIVE FLOATING ALERT POPUP WHEN A NEW NOTIFICATION ARRIVES */}
      {liveToast && (
        <div
          role="alert"
          className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[440px] z-[55] rounded-2xl bg-[#3B1050] text-white border-2 border-[#E2A7C6] shadow-2xl p-4 sm:p-5 space-y-3 no-print animate-bounce"
          style={{ animationIterationCount: 1, animationDuration: '0.55s' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#A8567F] text-white flex items-center justify-center shrink-0">
                <BellRing className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#F6CBE0]">
                  {isAdmin ? 'New Teacher Alert' : 'Important Notice from Admin'}
                </p>
                <p className="text-base font-bold leading-snug text-white">
                  {liveToast.title}
                </p>
                <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                  {liveToast.message}
                </p>
                <p className="text-[11px] text-white/70">
                  From {liveToast.actorName} · {formatNotifTime(liveToast)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 shrink-0"
              aria-label="Dismiss popup alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {liveToast.targetTab && (
              <button
                type="button"
                onClick={() => handleJump(liveToast)}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white text-[#3B1050] text-xs font-bold hover:bg-[#F4EEF7]"
              >
                Open now
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isAdmin && liveToast.audience === 'admin') {
                  handleMarkAlertRead(liveToast);
                } else if (!isAdmin) {
                  markLocalSeen([liveToast.id]);
                }
                setLiveToast(null);
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* BIG ALWAYS-VISIBLE TOP NOTIFICATION BANNER */}
      <div className="mb-6 no-print">
        {isAdmin ? (
          /* OWNER / ADMIN BIG NOTIFICATION BANNER */
          <div
            className={`rounded-2xl border-2 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
              unreadAdminAlerts.length > 0
                ? 'bg-gradient-to-r from-[#3B1050] via-[#531769] to-[#7A2A63] text-white border-[#D98EB3] shadow-lg'
                : 'bg-white dark:bg-[#1F1629] text-[#1F122B] dark:text-[#F5EEF9] border-[#E5D9EC] dark:border-[#332442] shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative ${
                  unreadAdminAlerts.length > 0
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#A8567F]'
                }`}
              >
                {unreadAdminAlerts.length > 0 ? (
                  <>
                    <BellRing className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow">
                      {unreadAdminAlerts.length}
                    </span>
                  </>
                ) : (
                  <Bell className="w-6 h-6" />
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wider ${
                      unreadAdminAlerts.length > 0
                        ? 'text-[#FFD6EA]'
                        : 'text-[#A8567F] dark:text-[#D98EB3]'
                    }`}
                  >
                    {unreadAdminAlerts.length > 0
                      ? `${unreadAdminAlerts.length} New Teacher Notification${unreadAdminAlerts.length > 1 ? 's' : ''}`
                      : 'Admin Notifications'}
                  </span>
                  {latestAdminAlert && (
                    <span
                      className={`text-xs ${
                        unreadAdminAlerts.length > 0
                          ? 'text-white/80'
                          : 'text-[#7A6888] dark:text-[#9D8AAD]'
                      }`}
                    >
                      · {formatNotifTime(latestAdminAlert)}
                    </span>
                  )}
                </div>
                {latestAdminAlert ? (
                  <div className="space-y-0.5">
                    <p
                      className={`text-sm sm:text-base font-bold leading-snug ${
                        unreadAdminAlerts.length > 0
                          ? 'text-white'
                          : 'text-[#1F122B] dark:text-[#F5EEF9]'
                      }`}
                    >
                      {latestAdminAlert.title}
                    </p>
                    <p
                      className={`text-xs sm:text-sm leading-snug line-clamp-2 ${
                        unreadAdminAlerts.length > 0
                          ? 'text-white/90'
                          : 'text-[#5A4A66] dark:text-[#C5B4D4]'
                      }`}
                    >
                      {latestAdminAlert.message}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-[#5A4A66] dark:text-[#C5B4D4]">
                    Live teacher alerts (surveys, 1-to-1 bookings, FAQs, resource suggestions) will
                    appear right here with a chime sound.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleSound}
                title={soundEnabled ? 'Notification sound is ON (click to mute)' : 'Sound muted (click to turn ON & test)'}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  unreadAdminAlerts.length > 0
                    ? 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {soundEnabled ? 'Sound On' : 'Muted'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminDrawerTab('alerts');
                  setShowComposer(false);
                  setDrawerOpen(true);
                }}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                  unreadAdminAlerts.length > 0
                    ? 'bg-white text-[#3B1050] hover:bg-[#F4EEF7]'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                }`}
              >
                <Bell className="w-4 h-4" />
                Alerts ({teacherAlertsForAdmin.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminDrawerTab('notices');
                  setShowComposer(true);
                  setDrawerOpen(true);
                }}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                  unreadAdminAlerts.length > 0
                    ? 'bg-[#A8567F] hover:bg-[#91446A] text-white border border-white/20'
                    : 'bg-[#3B1050] hover:bg-[#4E1869] text-white'
                }`}
              >
                <Megaphone className="w-4 h-4" />
                Post Notice ({publicNotices.length})
              </button>
            </div>
          </div>
        ) : (
          /* TEACHER & VIEWER BIG VISIBLE IMPORTANT NOTICE BANNER */
          <div
            className={`rounded-2xl border-2 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
              latestImportantNotice && unreadNoticesForUser.length > 0
                ? 'bg-gradient-to-r from-[#3B1050] via-[#5E1B61] to-[#8C376B] text-white border-[#E2A7C6] shadow-lg'
                : latestImportantNotice
                  ? 'bg-[#FAF3FA] dark:bg-[#241633] text-[#1F122B] dark:text-[#F5EEF9] border-[#A8567F]/70 shadow-sm'
                  : 'bg-white dark:bg-[#1F1629] text-[#1F122B] dark:text-[#F5EEF9] border-[#E5D9EC] dark:border-[#332442] shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative ${
                  latestImportantNotice && unreadNoticesForUser.length > 0
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#A8567F]'
                }`}
              >
                {latestImportantNotice ? (
                  <>
                    <Megaphone className="w-6 h-6" />
                    {unreadNoticesForUser.length > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow">
                        {unreadNoticesForUser.length}
                      </span>
                    )}
                  </>
                ) : (
                  <Bell className="w-6 h-6" />
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wider ${
                      latestImportantNotice && unreadNoticesForUser.length > 0
                        ? 'text-[#FFD6EA]'
                        : 'text-[#A8567F] dark:text-[#D98EB3]'
                    }`}
                  >
                    {latestImportantNotice
                      ? latestImportantNotice.priority === 'important'
                        ? 'Important Notice from Admin'
                        : 'Notice from Admin'
                      : 'Notices from Admin'}
                  </span>
                  {unreadNoticesForUser.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500 text-[11px] font-bold text-white">
                      {unreadNoticesForUser.length} NEW
                    </span>
                  )}
                  {latestImportantNotice && (
                    <span
                      className={`text-xs ${
                        unreadNoticesForUser.length > 0
                          ? 'text-white/80'
                          : 'text-[#7A6888] dark:text-[#9D8AAD]'
                      }`}
                    >
                      · {formatNotifTime(latestImportantNotice)}
                    </span>
                  )}
                </div>

                {latestImportantNotice ? (
                  <div className="space-y-0.5">
                    <p
                      className={`text-base sm:text-lg font-extrabold leading-snug ${
                        unreadNoticesForUser.length > 0
                          ? 'text-white'
                          : 'text-[#1F122B] dark:text-[#F5EEF9]'
                      }`}
                    >
                      {latestImportantNotice.title}
                    </p>
                    <p
                      className={`text-xs sm:text-sm leading-relaxed ${
                        unreadNoticesForUser.length > 0
                          ? 'text-white/95'
                          : 'text-[#3B2A48] dark:text-[#DFD0EC]'
                      }`}
                    >
                      {latestImportantNotice.message}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-[#5A4A66] dark:text-[#C5B4D4]">
                    Important notices from Tr Hein will appear right here with a notification sound.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleToggleSound}
                title={soundEnabled ? 'Notification sound is ON (click to mute)' : 'Sound muted (click to turn ON & test)'}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  latestImportantNotice && unreadNoticesForUser.length > 0
                    ? 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
                    : 'bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[#3B1050] dark:text-[#E8D5F5]'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {soundEnabled ? 'Sound On' : 'Muted'}
              </button>
              {latestImportantNotice?.targetTab && (
                <button
                  type="button"
                  onClick={() => handleJump(latestImportantNotice)}
                  className={`min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                    unreadNoticesForUser.length > 0
                      ? 'bg-white text-[#3B1050] hover:bg-[#F4EEF7]'
                      : 'bg-[#3B1050] text-white hover:bg-[#4E1869]'
                  }`}
                >
                  Open
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (publicNotices.length > 0) {
                    markLocalSeen(publicNotices.map((n) => n.id));
                  }
                  setDrawerOpen(true);
                }}
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                  latestImportantNotice && unreadNoticesForUser.length > 0
                    ? 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                }`}
              >
                <Bell className="w-4 h-4" />
                All notices ({publicNotices.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NOTIFICATION CENTER MODAL / DRAWER */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center p-4 sm:pt-12 no-print"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E5D9EC] dark:border-[#332442] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#A8567F]" />
                <div>
                  <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                    {isAdmin ? 'Notification Center & Important Notices' : 'Important Notices from Admin'}
                  </h2>
                  <p className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                    {isAdmin
                      ? 'Live teacher alerts with chime sound + big notices displayed across the Hub'
                      : 'Important updates and reminders from Tr Hein Tay Za'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl text-[#5A4A66] hover:bg-[#F4EEF7] dark:hover:bg-[#2A1D38]"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin Tabs */}
            {isAdmin && (
              <div className="px-5 pt-3 pb-2 border-b border-[#F0E6F5] dark:border-[#2E203D] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminDrawerTab('alerts');
                      setShowComposer(false);
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      adminDrawerTab === 'alerts'
                        ? 'bg-[#3B1050] text-white'
                        : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                    }`}
                  >
                    Teacher Alerts ({unreadAdminAlerts.length} unread)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminDrawerTab('notices')}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      adminDrawerTab === 'notices'
                        ? 'bg-[#A8567F] text-white'
                        : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                    }`}
                  >
                    Notices to Team ({publicNotices.length})
                  </button>
                </div>

                {adminDrawerTab === 'alerts' && unreadAdminAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAdminRead}
                    className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}

                {adminDrawerTab === 'notices' && (
                  <button
                    type="button"
                    onClick={() => setShowComposer((prev) => !prev)}
                    className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#3B1050] text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showComposer ? 'Close form' : 'New notice'}
                  </button>
                )}
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* ADMIN COMPOSER FOR IMPORTANT NOTICES */}
              {isAdmin && adminDrawerTab === 'notices' && showComposer && (
                <form
                  onSubmit={handlePublishNotice}
                  className="rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#A8567F]/40 p-4 space-y-3"
                >
                  <p className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                    Send Big Notice on the Hub (pops up live with a chime sound for teachers)
                  </p>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={nTitle}
                    onChange={(e) => setNTitle(e.target.value)}
                    placeholder="Notice title (e.g., Please complete Month 1 Survey by Friday)"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                  />
                  <textarea
                    rows={3}
                    required
                    maxLength={600}
                    value={nMessage}
                    onChange={(e) => setNMessage(e.target.value)}
                    placeholder="Write your clear, short notice for teachers..."
                    className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                  />
                  <div className="grid sm:grid-cols-3 gap-2">
                    <select
                      value={nAudience}
                      onChange={(e) => setNAudience(e.target.value as 'all' | 'teachers')}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs"
                    >
                      <option value="all">Visible to: Everyone (Teachers &amp; Viewers)</option>
                      <option value="teachers">Visible to: Teachers only</option>
                    </select>
                    <select
                      value={nPriority}
                      onChange={(e) => setNPriority(e.target.value as 'important' | 'normal')}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs"
                    >
                      <option value="important">Priority: Important (Big Banner + Sound)</option>
                      <option value="normal">Priority: Standard Notice</option>
                    </select>
                    <select
                      value={nTargetTab}
                      onChange={(e) => setNTargetTab(e.target.value as NavTab | '')}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs"
                    >
                      <option value="">Link button: None</option>
                      <option value="meetings">Link to: Meetings (Weekly &amp; 1-to-1)</option>
                      <option value="my-month-1">Link to: My Month 1 (Checklist &amp; Weekly Feedback)</option>
                      <option value="voice">Link to: Teacher Voice &amp; Survey</option>
                      <option value="training">Link to: Training</option>
                      <option value="resources">Link to: Resource Library</option>
                      <option value="roadmap">Link to: 6-Month Roadmap</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                      Appears live in the big notification banner &amp; chimes immediately for online teachers.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowComposer(false)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#E5D9EC] text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={publishing || !nTitle.trim() || !nMessage.trim()}
                        className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-xs font-semibold disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {publishing ? 'Publishing...' : 'Publish Big Notice'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* LIST OF ITEMS */}
              {isAdmin && adminDrawerTab === 'alerts' ? (
                teacherAlertsForAdmin.length === 0 ? (
                  <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9] text-center py-8">
                    No teacher alerts yet. Whenever a teacher submits the Needs Survey, books a
                    1-to-1 meeting, asks an FAQ question, or suggests a resource, it will appear
                    right here with a live chime sound.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {teacherAlertsForAdmin.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-xl p-3.5 border space-y-2 ${
                          !n.readByAdmin
                            ? 'bg-[#FAF7FC] dark:bg-[#241633] border-[#A8567F]/50'
                            : 'bg-white dark:bg-[#160F1F] border-[#E5D9EC] dark:border-[#332442]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              {!n.readByAdmin && (
                                <span className="px-1.5 py-0.5 rounded bg-[#A8567F] text-white font-bold">
                                  NEW
                                </span>
                              )}
                              <span className="font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
                                {n.actorName}
                              </span>
                              <span className="text-[#7A6888] dark:text-[#9D8AAD]">
                                · {formatNotifTime(n)}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                              {n.title}
                            </p>
                            <p className="text-xs text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                              {n.message}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteNotification(n.id)}
                            className="p-1.5 rounded-lg text-[#7A6888] hover:text-red-600"
                            aria-label="Delete alert"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {n.targetTab && (
                            <button
                              type="button"
                              onClick={() => handleJump(n)}
                              className="min-h-[32px] inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#3B1050] text-white text-xs font-semibold"
                            >
                              View in Hub
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                          {!n.readByAdmin && (
                            <button
                              type="button"
                              onClick={() => handleMarkAlertRead(n)}
                              className="min-h-[32px] inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                            >
                              <Check className="w-3 h-3" />
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* NOTICES LIST (Seen by Teachers, Viewers, and Admin under "Notices to Team") */
                <>
                  {!isAdmin && unreadNoticesForUser.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => markLocalSeen(publicNotices.map((n) => n.id))}
                        className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all seen
                      </button>
                    </div>
                  )}

                  {publicNotices.length === 0 ? (
                    <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9] text-center py-8">
                      {isAdmin
                        ? 'No notices posted yet. Click "New notice" above to display a big notice across the top of the website for teachers and viewers.'
                        : 'No important notices from Tr Hein right now.'}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {publicNotices.map((n) => {
                        const isUnreadLocal = !isAdmin && !seenIds.includes(n.id);
                        return (
                          <div
                            key={n.id}
                            className={`rounded-xl p-4 border space-y-2 ${
                              n.priority === 'important' || isUnreadLocal
                                ? 'bg-[#FAF7FC] dark:bg-[#241633] border-[#A8567F]/50'
                                : 'bg-white dark:bg-[#160F1F] border-[#E5D9EC] dark:border-[#332442]'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  {n.priority === 'important' && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#A8567F] text-white font-bold">
                                      IMPORTANT
                                    </span>
                                  )}
                                  {isUnreadLocal && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#3B1050] text-white font-bold">
                                      NEW
                                    </span>
                                  )}
                                  {isAdmin && (
                                    <span className="text-[#7A6888] dark:text-[#9D8AAD]">
                                      {n.audience === 'all' ? 'Everyone' : 'Teachers only'}
                                    </span>
                                  )}
                                  <span className="text-[#7A6888] dark:text-[#9D8AAD]">
                                    From {n.actorName} · {formatNotifTime(n)}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                                  {n.title}
                                </p>
                                <p className="text-xs sm:text-sm text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed whitespace-pre-line">
                                  {n.message}
                                </p>
                              </div>

                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNotification(n.id)}
                                  className="p-1.5 rounded-lg text-[#7A6888] hover:text-red-600"
                                  aria-label="Delete notice"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {n.targetTab && (
                                <button
                                  type="button"
                                  onClick={() => handleJump(n)}
                                  className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#3B1050] text-white text-xs font-semibold"
                                >
                                  Open section
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isAdmin &&
                                (n.audience === 'all' || n.audience === 'teachers') &&
                                getRegisteredEmailsForAudience(n.audience).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openNoticeEmailPrompt(
                                        n.title,
                                        n.message,
                                        n.audience as 'all' | 'teachers',
                                        n.priority,
                                        composerRecipients.length > 0
                                          ? composerRecipients
                                          : getRegisteredEmailsForAudience(n.audience as 'all' | 'teachers')
                                      )
                                    }
                                    className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:border-[#A8567F]"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-[#A8567F]" />
                                    Open in Email App ({getRegisteredEmailsForAudience(n.audience).length})
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
