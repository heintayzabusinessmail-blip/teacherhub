import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClock,
  ArrowRight,
  Clock,
  ExternalLink,
  Video,
  X,
} from 'lucide-react';
import { useHub } from '../context/HubContext';
import { emailToKey } from '../firebase';
import {
  formatLocalDateTime,
  formatMyanmarClock,
  formatMyanmarTimeOnly,
  getNextMyanmarSundaySlotIso,
} from '../utils/helpers';
import {
  ensureNotificationAudioUnlocked,
  isNotificationSoundEnabled,
  playNotificationChime,
} from '../utils/notificationSound';
import type { NavTab } from '../types';

export interface UpcomingMeetingItem {
  key: string;
  kind: 'weekly_team' | 'one_to_one' | 'training' | 'observation';
  badge: string;
  title: string;
  subtitle: string;
  startIso: string;
  startMs: number;
  targetTab: NavTab;
  zoomLink?: string;
  isPreview?: boolean;
}

const REMINDER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes before scheduled Myanmar Time
const GRACE_AFTER_START_MS = 60 * 1000; // Keep showing "Starting now" for 1 min after start
const DISMISSED_STORAGE_KEY = 'yao_dismissed_meeting_reminders_v1';

export const PREVIEW_MEETING_TOAST_EVENT = 'yao:preview-meeting-toast';

export function dispatchPreviewMeetingToast(detail?: Partial<UpcomingMeetingItem>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PREVIEW_MEETING_TOAST_EVENT, { detail }));
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return 'Starting now';
  const totalSeconds = Math.ceil(diffMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function readDismissedKeys(): string[] {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface MeetingReminderToastProps {
  onSelectTab: (tab: NavTab) => void;
}

export function MeetingReminderToast({ onSelectTab }: MeetingReminderToastProps) {
  const {
    user,
    isAdmin,
    oneToOneSlots,
    trainingSessions,
    trainingResponses,
    observations,
    weeklyMeetingVotes,
    weeklyMeetingInfo,
  } = useHub();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [dismissedKeys, setDismissedKeys] = useState<string[]>(() => readDismissedKeys());
  const [previewToast, setPreviewToast] = useState<UpcomingMeetingItem | null>(null);
  const chimedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    ensureNotificationAudioUnlocked();
  }, []);

  // Collect all scheduled meetings relevant to the signed-in user
  const scheduledMeetings = useMemo<UpcomingMeetingItem[]>(() => {
    if (!user) return [];
    const items: UpcomingMeetingItem[] = [];
    const myEmailKey = user.email ? emailToKey(user.email) : '';
    const refNow = new Date(nowMs);

    // 1. Weekly Academic Team Meeting with Tr YAO (Sunday 3-4 PM / 5-6 PM MMT)
    const myVote = weeklyMeetingVotes.find((v) => v.uid === user.uid);
    const sun34Votes = weeklyMeetingVotes.filter((v) => v.selectedOption === 'sun_3_4_pm').length;
    const sun56Votes = weeklyMeetingVotes.filter((v) => v.selectedOption === 'sun_5_6_pm').length;

    const sundayHoursToWatch: Array<{ hour: number; label: string }> = [];
    if (weeklyMeetingInfo?.confirmedSlot === 'sun_3_4_pm') {
      sundayHoursToWatch.push({ hour: 15, label: 'Confirmed: Sunday 3:00 – 4:00 PM (MMT)' });
    } else if (weeklyMeetingInfo?.confirmedSlot === 'sun_5_6_pm') {
      sundayHoursToWatch.push({ hour: 17, label: 'Confirmed: Sunday 5:00 – 6:00 PM (MMT)' });
    } else if (myVote?.selectedOption === 'sun_3_4_pm') {
      sundayHoursToWatch.push({ hour: 15, label: 'Sunday 3:00 – 4:00 PM (MMT)' });
    } else if (myVote?.selectedOption === 'sun_5_6_pm') {
      sundayHoursToWatch.push({ hour: 17, label: 'Sunday 5:00 – 6:00 PM (MMT)' });
    } else if (sun34Votes > 0 || sun56Votes > 0) {
      if (sun34Votes >= sun56Votes) {
        sundayHoursToWatch.push({ hour: 15, label: 'Sunday 3:00 – 4:00 PM (MMT)' });
      }
      if (sun56Votes >= sun34Votes) {
        sundayHoursToWatch.push({ hour: 17, label: 'Sunday 5:00 – 6:00 PM (MMT)' });
      }
    }

    sundayHoursToWatch.forEach(({ hour, label }) => {
      const startIso = getNextMyanmarSundaySlotIso(hour, refNow);
      const startMs = new Date(startIso).getTime();
      items.push({
        key: `weekly_team_${hour}_${startMs}`,
        kind: 'weekly_team',
        badge: 'Academic Team Meeting',
        title: 'Weekly Academic Team Meeting with Tr YAO',
        subtitle: label,
        startIso,
        startMs,
        targetTab: 'meetings',
        zoomLink: weeklyMeetingInfo?.zoomLink?.trim() || undefined,
      });
    });

    // 2. Booked 1-to-1 Welcome Meetings
    oneToOneSlots.forEach((slot) => {
      if (!slot.bookedByUid) return;
      const isRelevant = isAdmin || slot.bookedByUid === user.uid;
      if (!isRelevant) return;
      const startMs = new Date(slot.dateTimeIso).getTime();
      if (Number.isNaN(startMs)) return;
      items.push({
        key: `one_to_one_${slot.id}_${startMs}`,
        kind: 'one_to_one',
        badge: '1-to-1 Meeting',
        title: slot.label || '1-to-1 Welcome Meeting',
        subtitle:
          isAdmin && slot.bookedByUid !== user.uid
            ? `Booked with ${slot.bookedByName} · ${slot.durationMins} mins`
            : `With Tr Hein · ${slot.durationMins} mins`,
        startIso: slot.dateTimeIso,
        startMs,
        targetTab: 'meetings',
      });
    });

    // 3. Upcoming Training Workshops (skip if teacher explicitly marked "cannot_come")
    trainingSessions.forEach((session) => {
      if (session.status !== 'upcoming') return;
      const myResp = trainingResponses.find(
        (r) => r.sessionId === session.id && r.uid === user.uid
      );
      if (myResp?.rsvp === 'cannot_come') return;
      const startMs = new Date(session.dateTimeIso).getTime();
      if (Number.isNaN(startMs)) return;
      items.push({
        key: `training_${session.id}_${startMs}`,
        kind: 'training',
        badge: 'Teacher Training',
        title: session.title,
        subtitle: `Presenter: ${session.presenter} · ${session.durationMins} mins`,
        startIso: session.dateTimeIso,
        startMs,
        targetTab: 'training',
        zoomLink: session.zoomLink || undefined,
      });
    });

    // 4. Scheduled Baseline Class Observations
    observations.forEach((obs) => {
      if (obs.status !== 'scheduled') return;
      const isMine =
        obs.teacherUid === user.uid || (myEmailKey && obs.teacherEmailKey === myEmailKey);
      if (!isAdmin && !isMine) return;
      const startMs = new Date(obs.plannedDateIso).getTime();
      if (Number.isNaN(startMs)) return;
      items.push({
        key: `observation_${obs.id}_${startMs}`,
        kind: 'observation',
        badge: 'Class Observation',
        title: `Zoom Observation: ${obs.levelClass}`,
        subtitle:
          isAdmin && !isMine
            ? `Teacher: ${obs.teacherName}`
            : 'Supportive baseline visit with Tr Hein (not a test)',
        startIso: obs.plannedDateIso,
        startMs,
        targetTab: 'my-month-1',
      });
    });

    items.sort((a, b) => a.startMs - b.startMs);
    return items;
  }, [
    user,
    isAdmin,
    oneToOneSlots,
    trainingSessions,
    trainingResponses,
    observations,
    weeklyMeetingVotes,
    weeklyMeetingInfo,
    // Recompute scheduled list every minute (avoids unnecessary churn every second)
    Math.floor(nowMs / 60_000),
  ]);

  // Active meetings within the 10-minute alert window (and up to 1 minute after start)
  const activeAlerts = useMemo(() => {
    const live = scheduledMeetings.filter((m) => {
      if (dismissedKeys.includes(m.key)) return false;
      const diff = m.startMs - nowMs;
      return diff <= REMINDER_WINDOW_MS && diff >= -GRACE_AFTER_START_MS;
    });

    if (previewToast) {
      const diff = previewToast.startMs - nowMs;
      if (diff >= -GRACE_AFTER_START_MS) {
        return [previewToast, ...live.filter((m) => m.key !== previewToast.key)];
      }
    }
    return live;
  }, [scheduledMeetings, dismissedKeys, nowMs, previewToast]);

  // Tick every 1 second while a toast is visible for a smooth live countdown, else every 15 seconds
  useEffect(() => {
    const intervalMs = activeAlerts.length > 0 ? 1000 : 15_000;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [activeAlerts.length]);

  // Listen for preview toast trigger from MeetingsPage
  useEffect(() => {
    const handlePreview = (ev: Event) => {
      const customEv = ev as CustomEvent<Partial<UpcomingMeetingItem> | undefined>;
      const detail = customEv.detail || {};
      const simulatedStartMs = Date.now() + 9 * 60 * 1000 + 55 * 1000; // 9m 55s from now
      const simulatedStartIso = new Date(simulatedStartMs).toISOString();
      const previewItem: UpcomingMeetingItem = {
        key: `preview_${Date.now()}`,
        kind: detail.kind || 'weekly_team',
        badge: detail.badge || '10-Min Meeting Alert (Preview)',
        title: detail.title || 'Weekly Academic Team Meeting with Tr YAO',
        subtitle: detail.subtitle || 'Myanmar Time (MMT) scheduled meeting reminder',
        startIso: detail.startIso || simulatedStartIso,
        startMs: simulatedStartMs,
        targetTab: detail.targetTab || 'meetings',
        zoomLink: detail.zoomLink,
        isPreview: true,
      };
      setNowMs(Date.now());
      setPreviewToast(previewItem);
      if (isNotificationSoundEnabled()) {
        playNotificationChime(true);
      }
    };

    window.addEventListener(PREVIEW_MEETING_TOAST_EVENT, handlePreview);
    return () => window.removeEventListener(PREVIEW_MEETING_TOAST_EVENT, handlePreview);
  }, []);

  // Auto-chime once for each real meeting entering the 10-minute window
  useEffect(() => {
    const newlyTriggered = activeAlerts.filter(
      (a) => !a.isPreview && !chimedKeysRef.current.has(a.key)
    );
    if (newlyTriggered.length > 0) {
      newlyTriggered.forEach((a) => chimedKeysRef.current.add(a.key));
      if (isNotificationSoundEnabled()) {
        playNotificationChime(true);
      }
    }
  }, [activeAlerts]);

  const dismissAlert = (item: UpcomingMeetingItem) => {
    if (item.isPreview) {
      setPreviewToast(null);
      return;
    }
    setDismissedKeys((prev) => {
      const next = Array.from(new Set([...prev, item.key])).slice(-50);
      try {
        window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  if (activeAlerts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      aria-label="Upcoming meeting reminders"
      className="fixed bottom-20 lg:bottom-5 right-4 left-4 sm:left-auto sm:w-[420px] z-[58] space-y-3 pointer-events-none no-print"
    >
      {activeAlerts.slice(0, 3).map((item) => {
        const diffMs = item.startMs - nowMs;
        const isStartingNow = diffMs <= 0;
        const displayScheduledTime = item.isPreview
          ? formatLocalDateTime(item.startIso)
          : formatMyanmarTimeOnly(item.startMs);

        return (
          <div
            key={item.key}
            role="alert"
            className="pointer-events-auto rounded-2xl bg-white dark:bg-[#1F1629] border-2 border-[#A8567F] dark:border-[#D98EB3] shadow-2xl overflow-hidden"
          >
            {/* Top Accent Strip */}
            <div className="bg-gradient-to-r from-[#3B1050] via-[#5A1868] to-[#A8567F] px-4 py-2.5 flex items-center justify-between gap-2 text-white">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/20 shrink-0">
                  <AlarmClock className="w-4 h-4 animate-pulse" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#FFD6EA] truncate">
                    {item.badge}
                  </p>
                  <p className="text-xs font-bold leading-tight tabular-nums">
                    {isStartingNow
                      ? 'Starting now · Myanmar Time'
                      : `Starts in ${formatCountdown(diffMs)}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissAlert(item)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 shrink-0"
                aria-label="Dismiss meeting reminder"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Toast Body */}
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-[#5A4A66] dark:text-[#C5B4D4]">{item.subtitle}</p>
              </div>

              <div className="rounded-xl bg-[#FAF5FD] dark:bg-[#2A1C3A] border border-[#E5D9EC] dark:border-[#3E2D52] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-[#3B1050] dark:text-[#E8D5F5] inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-[#A8567F]" />
                  Scheduled: {displayScheduledTime}
                </span>
                <span className="text-[#6A5A78] dark:text-[#BBAAC9] tabular-nums">
                  Now: {formatMyanmarClock(new Date(nowMs))}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {item.zoomLink && (
                  <a
                    href={item.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Join Zoom
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab(item.targetTab);
                    dismissAlert(item);
                  }}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-bold"
                >
                  Open details
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => dismissAlert(item)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#5A4A66] dark:text-[#C5B4D4] hover:bg-[#F4EEF7] dark:hover:bg-[#2A1D38]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
