import React, { useMemo, useState } from 'react';
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
  X,
} from 'lucide-react';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { formatLocalDateTime } from '../utils/helpers';
import { publishAdminNotice } from '../utils/notifications';
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

    // 1. All matching allowlisted emails (Admin → Edit Access & Special Roles)
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

    // 2. Optional extra emails typed by Admin in the composer
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
      heading: `Email notice to ${recipients.length} registered recipient${recipients.length === 1 ? '' : 's'}`,
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
    const savedRecipients = getRegisteredEmailsForAudience(
      savedAudience,
      extraRecipientsText,
      includeSelfCopy
    );
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
      setNTitle('');
      setNMessage('');
      setNTargetTab('');
      setExtraRecipientsText('');
      setIncludeSelfCopy(false);
      setShowComposer(false);
      setAdminDrawerTab('notices');
      openNoticeEmailPrompt(
        savedTitle,
        savedMessage,
        savedAudience,
        savedPriority,
        savedRecipients
      );
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
    setDrawerOpen(false);
  };

  return (
    <>
      {/* ALWAYS-VISIBLE TOP NOTIFICATION BAR */}
      <div className="mb-5 no-print">
        {isAdmin ? (
          /* OWNER / ADMIN NOTIFICATION BAR */
          <div
            className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-xs ${
              unreadAdminAlerts.length > 0
                ? 'bg-[#3B1050] text-white border-[#3B1050]'
                : 'bg-white dark:bg-[#1F1629] text-[#1F122B] dark:text-[#F5EEF9] border-[#E5D9EC] dark:border-[#332442]'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  unreadAdminAlerts.length > 0
                    ? 'bg-[#A8567F] text-white'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#A8567F]'
                }`}
              >
                {unreadAdminAlerts.length > 0 ? (
                  <BellRing className="w-4 h-4" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${
                      unreadAdminAlerts.length > 0
                        ? 'text-[#F3C6DE]'
                        : 'text-[#A8567F] dark:text-[#D98EB3]'
                    }`}
                  >
                    {unreadAdminAlerts.length > 0
                      ? `${unreadAdminAlerts.length} New Teacher Alert${unreadAdminAlerts.length > 1 ? 's' : ''}`
                      : 'Admin Notifications'}
                  </span>
                  {latestAdminAlert && (
                    <span
                      className={`text-[11px] ${
                        unreadAdminAlerts.length > 0
                          ? 'text-white/75'
                          : 'text-[#7A6888] dark:text-[#9D8AAD]'
                      }`}
                    >
                      · {formatNotifTime(latestAdminAlert)}
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs sm:text-sm truncate ${
                    unreadAdminAlerts.length > 0
                      ? 'text-white font-medium'
                      : 'text-[#5A4A66] dark:text-[#C5B4D4]'
                  }`}
                >
                  {latestAdminAlert
                    ? `${latestAdminAlert.title} — ${latestAdminAlert.message}`
                    : 'You will be notified here automatically whenever a teacher submits a survey or books a 1-to-1 meeting.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAdminDrawerTab('alerts');
                  setShowComposer(false);
                  setDrawerOpen(true);
                }}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  unreadAdminAlerts.length > 0
                    ? 'bg-white text-[#3B1050] hover:bg-[#F4EEF7]'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                Alerts ({teacherAlertsForAdmin.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminDrawerTab('notices');
                  setShowComposer(true);
                  setDrawerOpen(true);
                }}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  unreadAdminAlerts.length > 0
                    ? 'bg-[#A8567F] hover:bg-[#91446A] text-white'
                    : 'bg-[#3B1050] hover:bg-[#4E1869] text-white'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5" />
                Post notice ({publicNotices.length})
              </button>
            </div>
          </div>
        ) : (
          /* TEACHER & VIEWER VISIBLE IMPORTANT NOTICE BAR */
          <div
            className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors shadow-xs ${
              latestImportantNotice && unreadNoticesForUser.length > 0
                ? 'bg-gradient-to-r from-[#3B1050] to-[#6B2158] text-white border-[#3B1050]'
                : latestImportantNotice
                  ? 'bg-white dark:bg-[#1F1629] text-[#1F122B] dark:text-[#F5EEF9] border-[#A8567F]/50'
                  : 'bg-white dark:bg-[#1F1629] text-[#1F122B] dark:text-[#F5EEF9] border-[#E5D9EC] dark:border-[#332442]'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  latestImportantNotice && unreadNoticesForUser.length > 0
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#A8567F]'
                }`}
              >
                {latestImportantNotice ? (
                  <Megaphone className="w-4 h-4" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${
                      latestImportantNotice && unreadNoticesForUser.length > 0
                        ? 'text-[#F6CBE0]'
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
                    <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold text-white">
                      {unreadNoticesForUser.length} new
                    </span>
                  )}
                  {latestImportantNotice && (
                    <span
                      className={`text-[11px] ${
                        unreadNoticesForUser.length > 0
                          ? 'text-white/75'
                          : 'text-[#7A6888] dark:text-[#9D8AAD]'
                      }`}
                    >
                      · {formatNotifTime(latestImportantNotice)}
                    </span>
                  )}
                </div>

                {latestImportantNotice ? (
                  <p
                    className={`text-xs sm:text-sm leading-snug mt-0.5 ${
                      unreadNoticesForUser.length > 0
                        ? 'text-white'
                        : 'text-[#1F122B] dark:text-[#F5EEF9]'
                    }`}
                  >
                    <strong>{latestImportantNotice.title}:</strong> {latestImportantNotice.message}
                  </p>
                ) : (
                  <p className="text-xs text-[#5A4A66] dark:text-[#C5B4D4]">
                    Important announcements from Tr Hein will appear visibly right here.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {latestImportantNotice?.targetTab && (
                <button
                  type="button"
                  onClick={() => handleJump(latestImportantNotice)}
                  className={`min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
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
                onClick={() => setDrawerOpen(true)}
                className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap ${
                  latestImportantNotice && unreadNoticesForUser.length > 0
                    ? 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
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
                      ? 'Live teacher alerts (surveys, 1-to-1 bookings, FAQs) and notices sent to teachers'
                      : 'Visible updates and reminders from Tr Hein Tay Za'}
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
                    Send Important Notice (appears in the top notification bar for everyone)
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
                      <option value="important">Priority: Important (Highlighted)</option>
                      <option value="normal">Priority: Standard Notice</option>
                    </select>
                    <select
                      value={nTargetTab}
                      onChange={(e) => setNTargetTab(e.target.value as NavTab | '')}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs"
                    >
                      <option value="">Link button: None</option>
                      <option value="voice">Link to: Teacher Voice &amp; Survey</option>
                      <option value="my-month-1">Link to: My Month 1 (1-to-1 Booking)</option>
                      <option value="training">Link to: Training</option>
                      <option value="resources">Link to: Resource Library</option>
                      <option value="roadmap">Link to: 6-Month Roadmap</option>
                    </select>
                  </div>
                  {/* Registered email recipients preview + optional extra emails */}
                  <div className="rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#3B1050] dark:text-[#E8D5F5] flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#A8567F]" />
                        Email recipients ({composerRecipients.length})
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-[#5A4A66] dark:text-[#BBAAC9] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeSelfCopy}
                          onChange={(e) => setIncludeSelfCopy(e.target.checked)}
                          className="rounded border-[#C9B3D9]"
                        />
                        Send a copy to my own email
                      </label>
                    </div>

                    {composerRecipients.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {composerRecipients.map((email) => (
                          <span
                            key={email}
                            className="px-2 py-0.5 rounded-md bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-[11px] text-[#3B1050] dark:text-[#E8D5F5]"
                          >
                            {email}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-2.5 py-1.5">
                        No registered teacher emails found yet. Add teacher emails in{' '}
                        <strong>Admin Dashboard → Edit Access &amp; Special Roles</strong>, or type
                        recipient email(s) below.
                      </p>
                    )}

                    <input
                      type="text"
                      value={extraRecipientsText}
                      onChange={(e) => setExtraRecipientsText(e.target.value)}
                      placeholder="Optional extra email(s), separated by commas (e.g., teacher@gmail.com)"
                      className="w-full min-h-[36px] px-2.5 py-1.5 rounded-lg border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                      {composerRecipients.length > 0
                        ? `Publishing shows the notice on-site and opens Gmail confirmation for ${composerRecipients.length} email(s).`
                        : 'Notice will appear on-site. Add recipient emails above to send via Gmail too.'}
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
                        {publishing
                          ? 'Publishing...'
                          : composerRecipients.length > 0
                            ? `Publish & Email (${composerRecipients.length})`
                            : 'Publish Notice'}
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
                    right here in real time.
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
                        ? 'No notices posted yet. Click "New notice" above to display an Important Notice across the top of the website for teachers and viewers.'
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
                                        n.priority
                                      )
                                    }
                                    className="min-h-[34px] inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:border-[#A8567F]"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-[#A8567F]" />
                                    Email registered ({getRegisteredEmailsForAudience(n.audience).length})
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
