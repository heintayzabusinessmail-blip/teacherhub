import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  GraduationCap,
  Users,
  Video,
} from 'lucide-react';
import {
  downloadIcsEvent,
  formatMyanmarTimeOnly,
  getGoogleCalendarUrl,
  getMyanmarDateKey,
  getMyanmarDateParts,
  MYANMAR_TIME_LABEL,
  myanmarYmdHmToIso,
  toDateKey,
} from '../utils/helpers';
import type {
  ObservationDoc,
  OneToOneSlot,
  TrainingSession,
  WeeklyMeetingInfo,
  WeeklyMeetingVote,
} from '../types';

interface MeetingsCalendarProps {
  oneToOneSlots: OneToOneSlot[];
  trainingSessions: TrainingSession[];
  observations: ObservationDoc[];
  weeklyMeetingInfo: WeeklyMeetingInfo | null;
  myVote: WeeklyMeetingVote | null;
  myUid: string;
  isAdmin: boolean;
  canInteract: boolean;
  hasMyBookedSlot: boolean;
  busySlotId: string | null;
  onBookSlot: (slotId: string) => void;
  onCancelSlot: (slotId: string) => void;
}

type CalendarKind =
  | 'weekly_team'
  | 'one_to_one_mine'
  | 'one_to_one_open'
  | 'one_to_one_other'
  | 'training'
  | 'observation';

type CalendarFilter = 'all' | 'mine' | 'weekly' | 'one_to_one' | 'training_obs';

interface CalendarSession {
  id: string;
  dateKey: string;
  startIso: string;
  timeLabel: string;
  durationMins: number;
  kind: CalendarKind;
  title: string;
  subtitle: string;
  badge: string;
  zoomLink?: string;
  slotId?: string;
  isMine: boolean;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getKindDotClass(kind: CalendarKind): string {
  switch (kind) {
    case 'weekly_team':
      return 'bg-[#3B1050] dark:bg-[#B87ED6]';
    case 'one_to_one_mine':
      return 'bg-emerald-600 dark:bg-emerald-400';
    case 'one_to_one_open':
      return 'bg-[#A8567F] dark:bg-[#E08BB5]';
    case 'one_to_one_other':
      return 'bg-sky-600 dark:bg-sky-400';
    case 'training':
      return 'bg-indigo-600 dark:bg-indigo-400';
    case 'observation':
      return 'bg-amber-500 dark:bg-amber-400';
  }
}

function getKindChipClass(kind: CalendarKind): string {
  switch (kind) {
    case 'weekly_team':
      return 'bg-[#3B1050] text-white dark:bg-[#5E247D] dark:text-white';
    case 'one_to_one_mine':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200 border border-emerald-300/70 dark:border-emerald-700/60';
    case 'one_to_one_open':
      return 'bg-[#FCEEF5] text-[#8B2C5C] dark:bg-[#3A1B2E] dark:text-[#F0A8CB] border border-[#A8567F]/30';
    case 'one_to_one_other':
      return 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200 border border-sky-300/60 dark:border-sky-800';
    case 'training':
      return 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 border border-indigo-300/60 dark:border-indigo-800';
    case 'observation':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800';
  }
}

export function MeetingsCalendar({
  oneToOneSlots,
  trainingSessions,
  observations,
  weeklyMeetingInfo,
  myVote,
  myUid,
  isAdmin,
  canInteract,
  hasMyBookedSlot,
  busySlotId,
  onBookSlot,
  onCancelSlot,
}: MeetingsCalendarProps) {
  const todayParts = useMemo(() => getMyanmarDateParts(new Date()), []);
  const todayKey = useMemo(
    () => toDateKey(todayParts.year, todayParts.month, todayParts.day),
    [todayParts]
  );

  const [viewYear, setViewYear] = useState(todayParts.year);
  const [viewMonth, setViewMonth] = useState(todayParts.month);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [filter, setFilter] = useState<CalendarFilter>('all');

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const now = getMyanmarDateParts(new Date());
    setViewYear(now.year);
    setViewMonth(now.month);
    setSelectedDateKey(toDateKey(now.year, now.month, now.day));
  };

  // Build all sessions occurring in the displayed month (Myanmar Time)
  const monthSessions = useMemo<CalendarSession[]>(() => {
    const items: CalendarSession[] = [];
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    // 1. Weekly Academic Team Meeting (every Sunday in the displayed month)
    const weeklyHour =
      weeklyMeetingInfo?.confirmedSlot === 'sun_5_6_pm'
        ? 17
        : weeklyMeetingInfo?.confirmedSlot === 'sun_3_4_pm'
          ? 15
          : myVote?.selectedOption === 'sun_5_6_pm'
            ? 17
            : 15;
    const weeklyTimeRange =
      weeklyHour === 17 ? '5:00 – 6:00 PM MMT' : '3:00 – 4:00 PM MMT';
    const weeklyBadge =
      weeklyMeetingInfo?.confirmedSlot === 'custom'
        ? 'Weekly · Custom Time'
        : weeklyMeetingInfo
          ? 'Confirmed Weekly'
          : 'Weekly Team Slot';

    for (let day = 1; day <= daysInMonth; day++) {
      const dow = new Date(Date.UTC(viewYear, viewMonth, day)).getUTCDay();
      if (dow === 0) {
        const dKey = toDateKey(viewYear, viewMonth, day);
        const startIso = myanmarYmdHmToIso(viewYear, viewMonth, day, weeklyHour, 0);
        items.push({
          id: `weekly_${dKey}`,
          dateKey: dKey,
          startIso,
          timeLabel:
            weeklyMeetingInfo?.confirmedSlot === 'custom' && weeklyMeetingInfo.customTimeLabel
              ? weeklyMeetingInfo.customTimeLabel
              : weeklyTimeRange,
          durationMins: 60,
          kind: 'weekly_team',
          title: 'Weekly Academic Team Meeting (Tr YAO)',
          subtitle:
            weeklyMeetingInfo?.meetingDateLabel ||
            'Every Sunday · Myanmar Time (MMT)',
          badge: weeklyBadge,
          zoomLink: weeklyMeetingInfo?.zoomLink?.trim() || undefined,
          isMine: true,
        });
      }
    }

    // 2. One-to-One Slots
    for (const slot of oneToOneSlots) {
      if (!slot.dateTimeIso) continue;
      const parts = getMyanmarDateParts(slot.dateTimeIso);
      if (parts.year !== viewYear || parts.month !== viewMonth) continue;
      const dKey = toDateKey(parts.year, parts.month, parts.day);
      const isMine = Boolean(myUid && slot.bookedByUid === myUid);
      const isOpen = !slot.bookedByUid;

      if (!isMine && !isOpen && !isAdmin) continue;

      items.push({
        id: `slot_${slot.id}`,
        dateKey: dKey,
        startIso: slot.dateTimeIso,
        timeLabel: formatMyanmarTimeOnly(slot.dateTimeIso),
        durationMins: slot.durationMins || 20,
        kind: isMine ? 'one_to_one_mine' : isOpen ? 'one_to_one_open' : 'one_to_one_other',
        title: slot.label || '1-to-1 Welcome Meeting',
        subtitle: isMine
          ? `Booked by You · ${slot.durationMins} mins${slot.notes ? ` · "${slot.notes}"` : ''}`
          : isOpen
            ? `Available 1-to-1 slot · ${slot.durationMins} mins with Tr Hein`
            : `Booked by ${slot.bookedByName} · ${slot.durationMins} mins`,
        badge: isMine ? 'Your 1-to-1' : isOpen ? 'Open 1-to-1' : `Booked · ${slot.bookedByName}`,
        slotId: slot.id,
        isMine,
      });
    }

    // 3. Training Workshops
    for (const session of trainingSessions) {
      if (!session.dateTimeIso) continue;
      const parts = getMyanmarDateParts(session.dateTimeIso);
      if (parts.year !== viewYear || parts.month !== viewMonth) continue;
      const dKey = toDateKey(parts.year, parts.month, parts.day);
      items.push({
        id: `training_${session.id}`,
        dateKey: dKey,
        startIso: session.dateTimeIso,
        timeLabel: formatMyanmarTimeOnly(session.dateTimeIso),
        durationMins: session.durationMins || 45,
        kind: 'training',
        title: session.title,
        subtitle: `Workshop · ${session.presenter} · ${session.durationMins} mins`,
        badge: session.status === 'completed' ? 'Workshop (Done)' : 'Training Workshop',
        zoomLink: session.zoomLink?.trim() || undefined,
        isMine: true,
      });
    }

    // 4. Observations (own for teacher, all for admin)
    for (const obs of observations) {
      if (!obs.plannedDateIso) continue;
      const parts = getMyanmarDateParts(obs.plannedDateIso);
      if (parts.year !== viewYear || parts.month !== viewMonth) continue;
      const dKey = toDateKey(parts.year, parts.month, parts.day);
      items.push({
        id: `obs_${obs.id}`,
        dateKey: dKey,
        startIso: obs.plannedDateIso,
        timeLabel: formatMyanmarTimeOnly(obs.plannedDateIso),
        durationMins: 45,
        kind: 'observation',
        title: isAdmin
          ? `Observation: ${obs.teacherName} (${obs.levelClass})`
          : `Class Observation (${obs.levelClass})`,
        subtitle: obs.purposeNote || 'Developmental class visit',
        badge: obs.status === 'scheduled' ? 'Scheduled Obs' : 'Observation',
        isMine: true,
      });
    }

    items.sort((a, b) => a.startIso.localeCompare(b.startIso));
    return items;
  }, [
    viewYear,
    viewMonth,
    weeklyMeetingInfo,
    myVote,
    oneToOneSlots,
    trainingSessions,
    observations,
    myUid,
    isAdmin,
  ]);

  const filteredSessions = useMemo(() => {
    return monthSessions.filter((s) => {
      if (filter === 'all') return true;
      if (filter === 'mine') return s.isMine;
      if (filter === 'weekly') return s.kind === 'weekly_team';
      if (filter === 'one_to_one') {
        return (
          s.kind === 'one_to_one_mine' ||
          s.kind === 'one_to_one_open' ||
          s.kind === 'one_to_one_other'
        );
      }
      if (filter === 'training_obs') {
        return s.kind === 'training' || s.kind === 'observation';
      }
      return true;
    });
  }, [monthSessions, filter]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();
    for (const item of filteredSessions) {
      const existing = map.get(item.dateKey) || [];
      existing.push(item);
      map.set(item.dateKey, existing);
    }
    return map;
  }, [filteredSessions]);

  // Build calendar day cells (leading blanks + days of month + trailing blanks to complete weeks)
  const calendarCells = useMemo(() => {
    const firstDow = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const cells: Array<{ day: number | null; dateKey: string | null }> = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push({ day: null, dateKey: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateKey: toDateKey(viewYear, viewMonth, d) });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateKey: null });
    }
    return cells;
  }, [viewYear, viewMonth]);

  // Ensure selectedDateKey reflects something meaningful when month changes
  const selectedDaySessions = sessionsByDate.get(selectedDateKey) || [];
  const selectedDayLabel = useMemo(() => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    if (!y || !m || !d) return selectedDateKey;
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  }, [selectedDateKey]);

  const upcomingInMonth = useMemo(() => {
    const todayIsoKey = getMyanmarDateKey(new Date());
    return filteredSessions.filter((s) => s.dateKey >= todayIsoKey).slice(0, 6);
  }, [filteredSessions]);

  const monthCounts = useMemo(() => {
    const weekly = monthSessions.filter((s) => s.kind === 'weekly_team').length;
    const oneToOnes = monthSessions.filter(
      (s) =>
        s.kind === 'one_to_one_mine' ||
        s.kind === 'one_to_one_open' ||
        s.kind === 'one_to_one_other'
    ).length;
    const workshopsAndObs = monthSessions.filter(
      (s) => s.kind === 'training' || s.kind === 'observation'
    ).length;
    return { weekly, oneToOnes, workshopsAndObs };
  }, [monthSessions]);

  return (
    <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header & Month Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#F0E6F5] dark:border-[#2E203D] pb-4">
        <div className="space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#A8567F]" />
            Monthly Sessions Calendar
          </h2>
          <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            Visualize all weekly team meetings, 1-to-1 slots, workshops &amp; observations in{' '}
            <strong>{MYANMAR_TIME_LABEL}</strong>. Click any date for details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] p-1">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="Previous month"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#3B1050] dark:text-[#E8D5F5] hover:bg-white dark:hover:bg-[#2A1D38] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] min-w-[144px] text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="Next month"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#3B1050] dark:text-[#E8D5F5] hover:bg-white dark:hover:bg-[#2A1D38] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={goToday}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F4EEF7] hover:bg-[#E8DCF0] dark:bg-[#2A1D38] dark:hover:bg-[#3A274A] text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Filter Bar + Quick Month Totals */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: `All (${monthSessions.length})` },
              { id: 'mine', label: 'My Schedule' },
              { id: 'weekly', label: `Weekly Team (${monthCounts.weekly})` },
              { id: 'one_to_one', label: `1-to-1s (${monthCounts.oneToOnes})` },
              { id: 'training_obs', label: `Workshops & Obs (${monthCounts.workshopsAndObs})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
                filter === f.id
                  ? 'bg-[#3B1050] text-white'
                  : 'bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-[#5A4A66] dark:text-[#BBAAC9] hover:bg-[#F4EEF7] dark:hover:bg-[#2A1D38]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B1050] dark:bg-[#B87ED6]" />
            Weekly Team
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            My 1-to-1
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A8567F]" />
            Open 1-to-1
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            Workshop
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Observation
          </span>
        </div>
      </div>

      {/* Main Split: Month Grid + Selected Day Panel */}
      <div className="grid xl:grid-cols-12 gap-5 items-start">
        {/* Left: 7-column Month Grid */}
        <div className="xl:col-span-8 rounded-2xl border border-[#E5D9EC] dark:border-[#332442] overflow-hidden">
          <div className="grid grid-cols-7 bg-[#FAF7FC] dark:bg-[#160F1F] border-b border-[#E5D9EC] dark:border-[#332442]">
            {WEEKDAY_HEADERS.map((wd) => (
              <div
                key={wd}
                className="py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-[#5A4A66] dark:text-[#BBAAC9]"
              >
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-[#EFE4F5] dark:divide-[#2D1F3C] bg-white dark:bg-[#1B1224]">
            {calendarCells.map((cell, idx) => {
              if (!cell.day || !cell.dateKey) {
                return (
                  <div
                    key={`blank_${idx}`}
                    className="min-h-[76px] sm:min-h-[96px] bg-[#FAF7FC]/50 dark:bg-[#140D1A]/50"
                  />
                );
              }
              const dayEvents = sessionsByDate.get(cell.dateKey) || [];
              const isToday = cell.dateKey === todayKey;
              const isSelected = cell.dateKey === selectedDateKey;

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.dateKey!)}
                  className={`min-h-[76px] sm:min-h-[96px] p-1.5 sm:p-2 text-left flex flex-col justify-between transition-colors relative focus:outline-none ${
                    isSelected
                      ? 'bg-[#F4EEF7] dark:bg-[#2C1C3E] ring-2 ring-inset ring-[#3B1050] dark:ring-[#D98EB3]'
                      : 'hover:bg-[#FAF7FC] dark:hover:bg-[#221730]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold tabular-nums ${
                        isToday
                          ? 'bg-[#3B1050] text-white'
                          : isSelected
                            ? 'text-[#3B1050] dark:text-[#F5EEF9]'
                            : 'text-[#1F122B] dark:text-[#DFD0EC]'
                      }`}
                    >
                      {cell.day}
                    </span>
                    {isToday && (
                      <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wide text-[#A8567F] dark:text-[#E08BB5]">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Desktop compact session pills */}
                  {dayEvents.length > 0 && (
                    <div className="mt-1 space-y-1 w-full">
                      <div className="hidden sm:flex flex-col gap-1">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate leading-tight ${getKindChipClass(
                              ev.kind
                            )}`}
                            title={`${ev.timeLabel} · ${ev.title}`}
                          >
                            {ev.kind === 'weekly_team'
                              ? `Sun Team`
                              : ev.kind === 'one_to_one_mine'
                                ? 'My 1-to-1'
                                : ev.kind === 'one_to_one_open'
                                  ? 'Open 1-to-1'
                                  : ev.kind === 'one_to_one_other'
                                    ? ev.badge
                                    : ev.kind === 'training'
                                      ? 'Workshop'
                                      : 'Observation'}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[10px] font-bold text-[#7A6888] dark:text-[#BBAAC9] pl-1">
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>

                      {/* Mobile colored dots */}
                      <div className="flex sm:hidden flex-wrap items-center gap-1 pt-1">
                        {dayEvents.slice(0, 4).map((ev) => (
                          <span
                            key={ev.id}
                            className={`w-2 h-2 rounded-full ${getKindDotClass(ev.kind)}`}
                          />
                        ))}
                        {dayEvents.length > 4 && (
                          <span className="text-[9px] font-bold text-[#5A4A66] dark:text-[#BBAAC9]">
                            +{dayEvents.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Details & Upcoming List */}
        <div className="xl:col-span-4 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-2 border-b border-[#E5D9EC] dark:border-[#332442] pb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#A8567F] dark:text-[#D98EB3]">
                Selected Day (MMT)
              </p>
              <h3 className="text-sm sm:text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                {selectedDayLabel}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[11px] font-bold text-[#3B1050] dark:text-[#E8D5F5] tabular-nums shrink-0">
              {selectedDaySessions.length}{' '}
              {selectedDaySessions.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>

          {selectedDaySessions.length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                No sessions scheduled on this date.
              </p>
              {upcomingInMonth.length > 0 && (
                <div className="pt-3 border-t border-[#E5D9EC] dark:border-[#332442] text-left space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A6888] dark:text-[#9D8AAD]">
                    Upcoming in {MONTH_NAMES[viewMonth]}
                  </p>
                  <div className="space-y-1.5">
                    {upcomingInMonth.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedDateKey(ev.dateKey)}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] hover:border-[#A8567F] text-left flex items-center justify-between gap-2 transition-colors"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${getKindDotClass(
                              ev.kind
                            )}`}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#1F122B] dark:text-[#F5EEF9] truncate">
                              {ev.title}
                            </p>
                            <p className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                              {ev.dateKey} · {ev.timeLabel}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDaySessions.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${getKindChipClass(
                        ev.kind
                      )}`}
                    >
                      {ev.kind === 'weekly_team' && <Users className="w-3 h-3" />}
                      {ev.kind === 'training' && <GraduationCap className="w-3 h-3" />}
                      {(ev.kind === 'one_to_one_mine' ||
                        ev.kind === 'one_to_one_open' ||
                        ev.kind === 'one_to_one_other') && <CalendarCheck className="w-3 h-3" />}
                      {ev.badge}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3B1050] dark:text-[#E2B8D0] tabular-nums">
                      <Clock className="w-3 h-3 text-[#A8567F]" />
                      {ev.timeLabel}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                      {ev.title}
                    </p>
                    <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5">
                      {ev.subtitle}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {ev.zoomLink && (
                      <a
                        href={ev.zoomLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                      >
                        <Video className="w-3 h-3" />
                        Join Zoom
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {ev.kind === 'one_to_one_open' &&
                      ev.slotId &&
                      canInteract &&
                      !hasMyBookedSlot && (
                        <button
                          type="button"
                          disabled={busySlotId === ev.slotId}
                          onClick={() => onBookSlot(ev.slotId!)}
                          className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#3B1050] hover:bg-[#4E1869] text-white text-[11px] font-bold disabled:opacity-50"
                        >
                          {busySlotId === ev.slotId ? 'Booking...' : 'Book this slot'}
                        </button>
                      )}

                    {ev.kind === 'one_to_one_mine' && ev.slotId && canInteract && (
                      <button
                        type="button"
                        disabled={busySlotId === ev.slotId}
                        onClick={() => onCancelSlot(ev.slotId!)}
                        className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 text-[11px] font-semibold disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}

                    <a
                      href={getGoogleCalendarUrl({
                        title: `YAO English: ${ev.title}`,
                        startIso: ev.startIso,
                        durationMins: ev.durationMins,
                        description: ev.subtitle,
                        location: ev.zoomLink || 'Zoom / Online',
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] text-[11px] font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                    >
                      <CalendarPlus className="w-3 h-3 text-[#A8567F]" />
                      GCal
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        downloadIcsEvent({
                          title: `YAO English: ${ev.title}`,
                          startIso: ev.startIso,
                          durationMins: ev.durationMins,
                          description: ev.subtitle,
                          location: ev.zoomLink || 'Zoom / Online',
                        })
                      }
                      className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] text-[11px] font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                    >
                      <Download className="w-3 h-3 text-[#A8567F]" />
                      .ics
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
