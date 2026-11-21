import React, { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  ListTodo,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { useHub } from '../context/HubContext';
import { PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import {
  downloadIcsEvent,
  formatLocalDateTime,
  formatMyanmarClock,
  getGoogleCalendarUrl,
  getNextMyanmarSundaySlotIso,
  getViewerTimeZone,
  MYANMAR_TIME_LABEL,
} from '../utils/helpers';
import { notifyAdminOfTeacherAction } from '../utils/notifications';
import { dispatchPreviewMeetingToast } from '../components/MeetingReminderToast';
import type { MeetingAgendaItem, WeeklyMeetingOption } from '../types';

const WEEKLY_MEETING_OPTIONS: Array<{
  id: WeeklyMeetingOption;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'sun_3_4_pm',
    title: 'Sunday 3:00 – 4:00 PM (MMT)',
    subtitle: 'Weekly Academic Team Meeting with Tr YAO · Afternoon slot',
  },
  {
    id: 'sun_5_6_pm',
    title: 'Sunday 5:00 – 6:00 PM (MMT)',
    subtitle: 'Weekly Academic Team Meeting with Tr YAO · Early evening slot',
  },
  {
    id: 'other',
    title: 'Other — Suggest a time',
    subtitle: 'If neither Sunday slot works for your classes, propose another Myanmar Time slot',
  },
];

export function formatWeeklyOptionLabel(option: WeeklyMeetingOption, suggestedTime?: string): string {
  if (option === 'sun_3_4_pm') return 'Sunday 3:00 – 4:00 PM (MMT)';
  if (option === 'sun_5_6_pm') return 'Sunday 5:00 – 6:00 PM (MMT)';
  return suggestedTime?.trim() ? `Other: ${suggestedTime.trim()}` : 'Other suggested time';
}

export function MeetingsPage() {
  const {
    user,
    isAdmin,
    canInteract,
    myProfile,
    oneToOneSlots,
    weeklyMeetingVotes,
    weeklyMeetingInfo,
    meetingAgendaItems,
    queueEmailConfirmation,
  } = useHub();

  // Academic Team Weekly Meeting Poll state
  const myVote = useMemo(
    () => (user ? weeklyMeetingVotes.find((v) => v.uid === user.uid) || null : null),
    [weeklyMeetingVotes, user]
  );

  const [selectedOption, setSelectedOption] = useState<WeeklyMeetingOption>('sun_3_4_pm');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [voteNote, setVoteNote] = useState('');
  const [savingVote, setSavingVote] = useState(false);
  const [voteSavedMsg, setVoteSavedMsg] = useState('');
  const [voteError, setVoteError] = useState('');
  const [mmtClockText, setMmtClockText] = useState(() => formatMyanmarClock());

  // Weekly Meeting Zoom Link & Action Notes (Admin editor)
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoSlot, setInfoSlot] = useState<'sun_3_4_pm' | 'sun_5_6_pm' | 'custom'>('sun_3_4_pm');
  const [infoCustomLabel, setInfoCustomLabel] = useState('');
  const [infoZoomLink, setInfoZoomLink] = useState('');
  const [infoDateLabel, setInfoDateLabel] = useState('Every Sunday · Myanmar Time (MMT)');
  const [infoNotes, setInfoNotes] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Weekly Meeting Agenda form
  const [agendaTopic, setAgendaTopic] = useState('');
  const [agendaDetails, setAgendaDetails] = useState('');
  const [savingAgenda, setSavingAgenda] = useState(false);

  // 1-to-1 Booking state
  const [bookingNotes, setBookingNotes] = useState('');
  const [busySlotId, setBusySlotId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setMmtClockText(formatMyanmarClock()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (myVote) {
      setSelectedOption(myVote.selectedOption);
      setSuggestedTime(myVote.suggestedTime || '');
      setVoteNote(myVote.note || '');
    }
  }, [myVote]);

  const mySlot = useMemo(
    () => (user ? oneToOneSlots.find((s) => s.bookedByUid === user.uid) || null : null),
    [oneToOneSlots, user]
  );

  const availableSlots = useMemo(
    () => oneToOneSlots.filter((s) => !s.bookedByUid),
    [oneToOneSlots]
  );

  const voteStats = useMemo(() => {
    const sun34 = weeklyMeetingVotes.filter((v) => v.selectedOption === 'sun_3_4_pm');
    const sun56 = weeklyMeetingVotes.filter((v) => v.selectedOption === 'sun_5_6_pm');
    const other = weeklyMeetingVotes.filter((v) => v.selectedOption === 'other');
    const total = weeklyMeetingVotes.length;
    return { sun34, sun56, other, total };
  }, [weeklyMeetingVotes]);

  const openAgendaCount = useMemo(
    () => meetingAgendaItems.filter((a) => a.status === 'open').length,
    [meetingAgendaItems]
  );

  const confirmedTimeDisplay = useMemo(() => {
    if (!weeklyMeetingInfo) return 'Pending team vote (Sunday 3–4 PM or 5–6 PM MMT)';
    if (weeklyMeetingInfo.confirmedSlot === 'sun_3_4_pm') return 'Sunday 3:00 – 4:00 PM (MMT)';
    if (weeklyMeetingInfo.confirmedSlot === 'sun_5_6_pm') return 'Sunday 5:00 – 6:00 PM (MMT)';
    return weeklyMeetingInfo.customTimeLabel || 'Custom time (Myanmar Time · MMT)';
  }, [weeklyMeetingInfo]);

  const openInfoEditor = () => {
    setInfoSlot(weeklyMeetingInfo?.confirmedSlot || 'sun_3_4_pm');
    setInfoCustomLabel(weeklyMeetingInfo?.customTimeLabel || '');
    setInfoZoomLink(weeklyMeetingInfo?.zoomLink || '');
    setInfoDateLabel(weeklyMeetingInfo?.meetingDateLabel || 'Every Sunday · Myanmar Time (MMT)');
    setInfoNotes(weeklyMeetingInfo?.latestNotes || '');
    setEditingInfo(true);
  };

  const handleSaveMeetingInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setSavingInfo(true);
    try {
      await setDoc(doc(db, 'weeklyMeetingInfo', 'current'), {
        confirmedSlot: infoSlot,
        customTimeLabel: infoCustomLabel.trim().slice(0, 160),
        zoomLink: infoZoomLink.trim().slice(0, 500),
        meetingDateLabel: (infoDateLabel.trim() || 'Every Sunday · Myanmar Time (MMT)').slice(
          0,
          120
        ),
        latestNotes: infoNotes.trim().slice(0, 2500),
        updatedBy: (myProfile?.displayName || user.displayName || 'Tr Hein Tay Za').slice(0, 120),
        updatedAt: serverTimestamp(),
      });
      setEditingInfo(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'weeklyMeetingInfo/current');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleAddAgendaItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canInteract) return;
    const trimmedTopic = agendaTopic.trim().slice(0, 300);
    if (trimmedTopic.length < 3) return;
    const trimmedDetails = agendaDetails.trim().slice(0, 600);
    const authorName = (
      myProfile?.displayName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'YAO Teacher'
    ).slice(0, 120);

    setSavingAgenda(true);
    try {
      await addDoc(collection(db, 'meetingAgendaItems'), {
        authorUid: user.uid,
        authorName,
        topic: trimmedTopic,
        details: trimmedDetails,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await notifyAdminOfTeacherAction({
        actorUid: user.uid,
        actorName: authorName,
        category: 'meeting_agenda',
        title: `${authorName} added an agenda topic for Sunday’s meeting`,
        message: `${trimmedTopic}${trimmedDetails ? ` — ${trimmedDetails}` : ''}`.slice(0, 600),
        targetTab: 'meetings',
        priority: 'normal',
      });
      setAgendaTopic('');
      setAgendaDetails('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'meetingAgendaItems');
    } finally {
      setSavingAgenda(false);
    }
  };

  const handleToggleAgendaStatus = async (item: MeetingAgendaItem) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'meetingAgendaItems', item.id), {
        status: item.status === 'open' ? 'discussed' : 'open',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `meetingAgendaItems/${item.id}`);
    }
  };

  const handleDeleteAgendaItem = async (id: string) => {
    if (!canInteract) return;
    try {
      await deleteDoc(doc(db, 'meetingAgendaItems', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `meetingAgendaItems/${id}`);
    }
  };

  const handleSaveWeeklyVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canInteract) return;
    setVoteError('');
    setVoteSavedMsg('');

    const trimmedSuggested = selectedOption === 'other' ? suggestedTime.trim().slice(0, 200) : '';
    if (selectedOption === 'other' && trimmedSuggested.length < 2) {
      setVoteError('Please type your suggested day and time (in Myanmar Time).');
      return;
    }

    const teacherName = (
      myProfile?.displayName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'YAO Teacher'
    ).slice(0, 120);
    const trimmedNote = voteNote.trim().slice(0, 400);

    setSavingVote(true);
    try {
      const voteRef = doc(db, 'weeklyMeetingVotes', user.uid);
      if (myVote) {
        await updateDoc(voteRef, {
          teacherName,
          selectedOption,
          suggestedTime: trimmedSuggested,
          note: trimmedNote,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(voteRef, {
          uid: user.uid,
          teacherName,
          selectedOption,
          suggestedTime: trimmedSuggested,
          note: trimmedNote,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const choiceLabel = formatWeeklyOptionLabel(selectedOption, trimmedSuggested);
      await notifyAdminOfTeacherAction({
        actorUid: user.uid,
        actorName: teacherName,
        category: 'weekly_meeting_vote',
        title: `${teacherName} selected weekly Academic Team Meeting time`,
        message: `Choice: ${choiceLabel}${trimmedNote ? ` — Note: "${trimmedNote}"` : ''}`.slice(
          0,
          600
        ),
        targetTab: 'meetings',
        priority: 'important',
      });

      setVoteSavedMsg(`Saved your preference: ${choiceLabel}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `weeklyMeetingVotes/${user.uid}`);
    } finally {
      setSavingVote(false);
    }
  };

  const handleDeleteVote = async (uidToDelete: string) => {
    if (!user || (!isAdmin && user.uid !== uidToDelete)) return;
    try {
      await deleteDoc(doc(db, 'weeklyMeetingVotes', uidToDelete));
      if (uidToDelete === user.uid) {
        setSelectedOption('sun_3_4_pm');
        setSuggestedTime('');
        setVoteNote('');
        setVoteSavedMsg('');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `weeklyMeetingVotes/${uidToDelete}`);
    }
  };

  const handleBookSlot = async (slotId: string) => {
    if (!user || !myProfile || !canInteract) return;
    setBusySlotId(slotId);
    const slot = oneToOneSlots.find((s) => s.id === slotId);
    const trimmedNotes = bookingNotes.trim().slice(0, 300);
    try {
      await updateDoc(doc(db, 'oneToOneSlots', slotId), {
        bookedByUid: user.uid,
        bookedByName: myProfile.displayName.slice(0, 120),
        notes: trimmedNotes,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'teachers', user.uid), {
        checklist: { ...myProfile.checklist, oneToOneBooked: true },
        updatedAt: serverTimestamp(),
      });
      const whenLabel = slot ? formatLocalDateTime(slot.dateTimeIso) : 'a 1-to-1 slot';
      const bookTitle = `${myProfile.displayName} booked a 1-to-1 meeting`;
      const bookMsg = `${slot?.label || '1-to-1 Chat'} on ${whenLabel}${
        trimmedNotes ? `\nNote: "${trimmedNotes}"` : ''
      }`;
      await notifyAdminOfTeacherAction({
        actorUid: user.uid,
        actorName: myProfile.displayName,
        category: 'meeting_booked',
        title: bookTitle,
        message: bookMsg.slice(0, 600),
        targetTab: 'admin',
        priority: 'important',
      });
      if (user.email?.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL) {
        queueEmailConfirmation({
          heading: 'Send 1-to-1 booking email to Tr Hein',
          recipients: [BOOTSTRAPPED_ADMIN_EMAIL],
          subject: `[YAO Hub] ${bookTitle} (${whenLabel})`,
          bodyText: `${bookTitle}\n\nSession: ${bookMsg}\n\nView all bookings in Admin Dashboard.`,
          senderLabel: `Booked by ${myProfile.displayName}`,
        });
      }
      setBookingNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `oneToOneSlots/${slotId}`);
    } finally {
      setBusySlotId(null);
    }
  };

  const handleCancelSlot = async (slotId: string) => {
    if (!user || !myProfile || !canInteract) return;
    setBusySlotId(slotId);
    const slot = oneToOneSlots.find((s) => s.id === slotId);
    try {
      await updateDoc(doc(db, 'oneToOneSlots', slotId), {
        bookedByUid: '',
        bookedByName: '',
        notes: '',
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'teachers', user.uid), {
        checklist: { ...myProfile.checklist, oneToOneBooked: false },
        updatedAt: serverTimestamp(),
      });
      const whenLabel = slot ? formatLocalDateTime(slot.dateTimeIso) : 'their 1-to-1 slot';
      const cancelTitle = `${myProfile.displayName} cancelled a 1-to-1 booking`;
      const cancelMsg = `Freed up ${slot?.label || '1-to-1 slot'} on ${whenLabel}.`;
      await notifyAdminOfTeacherAction({
        actorUid: user.uid,
        actorName: myProfile.displayName,
        category: 'meeting_cancelled',
        title: cancelTitle,
        message: cancelMsg,
        targetTab: 'admin',
        priority: 'normal',
      });
      if (user.email?.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL) {
        queueEmailConfirmation({
          heading: 'Email booking cancellation to Tr Hein',
          recipients: [BOOTSTRAPPED_ADMIN_EMAIL],
          subject: `[YAO Hub] ${cancelTitle}`,
          bodyText: `${cancelTitle}\n\n${cancelMsg}`,
          senderLabel: `Sent by ${myProfile.displayName}`,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `oneToOneSlots/${slotId}`);
    } finally {
      setBusySlotId(null);
    }
  };

  const handlePreviewAlert = () => {
    if (mySlot) {
      dispatchPreviewMeetingToast({
        kind: 'one_to_one',
        badge: '10-Min Reminder Preview · 1-to-1',
        title: mySlot.label || '1-to-1 Welcome Meeting',
        subtitle: `With Tr Hein · ${mySlot.durationMins} mins`,
        startIso: mySlot.dateTimeIso,
        targetTab: 'meetings',
      });
      return;
    }
    const chosenHour =
      weeklyMeetingInfo?.confirmedSlot === 'sun_5_6_pm' ||
      myVote?.selectedOption === 'sun_5_6_pm'
        ? 17
        : 15;
    const slotLabel =
      chosenHour === 17 ? 'Sunday 5:00 – 6:00 PM (MMT)' : 'Sunday 3:00 – 4:00 PM (MMT)';
    dispatchPreviewMeetingToast({
      kind: 'weekly_team',
      badge: '10-Min Reminder Preview · Academic Team',
      title: 'Weekly Academic Team Meeting with Tr YAO',
      subtitle: slotLabel,
      startIso: getNextMyanmarSundaySlotIso(chosenHour),
      targetTab: 'meetings',
      zoomLink: weeklyMeetingInfo?.zoomLink?.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Meetings" inShort={PAGE_SUMMARIES.meetings} />

      {/* Live 10-Minute Myanmar Time Reminder Status Strip */}
      <div className="rounded-2xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] px-4 py-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#A8567F] flex items-center justify-center shrink-0">
            <AlarmClock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Automatic 10-minute meeting alerts active ({MYANMAR_TIME_LABEL})
            </p>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] tabular-nums">
              Current Myanmar Time:{' '}
              <strong className="text-[#3B1050] dark:text-[#E8D5F5]">{mmtClockText}</strong> ·
              Alerts pop up with a chime 10 mins before your weekly team meeting, 1-to-1s,
              workshops &amp; observations.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePreviewAlert}
          className="min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F4EEF7] hover:bg-[#E8DCF0] dark:bg-[#2A1D38] dark:hover:bg-[#3A274A] text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] whitespace-nowrap shrink-0 transition-colors"
        >
          <AlarmClock className="w-3.5 h-3.5 text-[#A8567F]" />
          Preview 10-min alert
        </button>
      </div>

      {/* 1. ACADEMIC TEAM MEETING — WEEKLY WITH TR YAO (POLL) */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border-2 border-[#A8567F]/40 dark:border-[#6D3A58] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#F0E6F5] dark:border-[#2E203D] pb-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A8567F] dark:text-[#D98EB3] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Weekly Academic Team Meeting · With Tr YAO
            </p>
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Choose Our Weekly Academic Team Meeting Time
            </h2>
            <p className="text-xs sm:text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Please choose <strong>one preferred Sunday slot</strong> with Tr YAO (or suggest
              another time that works better for your classes). All times are in{' '}
              <strong>{MYANMAR_TIME_LABEL}</strong>.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] shrink-0">
            <Clock className="w-3.5 h-3.5 text-[#A8567F]" />
            {voteStats.total} {voteStats.total === 1 ? 'teacher' : 'teachers'} voted
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left: Voting Form */}
          <div className="lg:col-span-7 space-y-4">
            {canInteract ? (
              <form onSubmit={handleSaveWeeklyVote} className="space-y-4">
                <div className="space-y-2.5">
                  {WEEKLY_MEETING_OPTIONS.map((opt) => {
                    const active = selectedOption === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          active
                            ? 'border-[#3B1050] bg-[#FAF5FD] dark:bg-[#2A1C3A] dark:border-[#D98EB3]'
                            : 'border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] hover:border-[#C5A9D6]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="weeklyMeetingOption"
                          value={opt.id}
                          checked={active}
                          onChange={() => {
                            setSelectedOption(opt.id);
                            setVoteError('');
                            setVoteSavedMsg('');
                          }}
                          className="mt-1 h-4 w-4 accent-[#3B1050] shrink-0"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm sm:text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                            {opt.title}
                          </p>
                          <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                            {opt.subtitle}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {selectedOption === 'other' && (
                  <div className="space-y-1.5 pl-1">
                    <label className="block text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                      Your suggested day &amp; time (Myanmar Time · MMT) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={200}
                      value={suggestedTime}
                      onChange={(e) => setSuggestedTime(e.target.value)}
                      placeholder="e.g., Sunday 7:00 – 8:00 PM (MMT) or Saturday 4:00 – 5:00 PM (MMT)"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#A8567F]/60 dark:border-[#6D3A58] bg-white dark:bg-[#140D1A] text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9]">
                    Optional note (e.g., class clashes or topic to discuss with Tr YAO)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={voteNote}
                    onChange={(e) => setVoteNote(e.target.value)}
                    placeholder="Optional short note..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                  />
                </div>

                {voteError && (
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">{voteError}</p>
                )}

                {voteSavedMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{voteSavedMsg}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={savingVote}
                    className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {savingVote
                      ? 'Saving...'
                      : myVote
                        ? 'Update my meeting time choice'
                        : 'Submit my meeting time choice'}
                  </button>

                  {myVote && (
                    <button
                      type="button"
                      onClick={() => handleDeleteVote(myVote.uid)}
                      className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear my vote
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] flex items-start gap-2.5 text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                <Eye className="w-4 h-4 text-[#A8567F] shrink-0 mt-0.5" />
                <span>
                  You have view-only access. Registered YAO teachers can choose Sunday 3–4 PM MMT,
                  Sunday 5–6 PM MMT, or suggest another time here.
                </span>
              </div>
            )}
          </div>

          {/* Right: Live Team Results */}
          <div className="lg:col-span-5 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                Live Team Preferences
              </h3>
              <span className="text-[11px] font-semibold text-[#7A6888] dark:text-[#9D8AAD]">
                Myanmar Time (MMT)
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#1F122B] dark:text-[#F5EEF9]">Sunday 3:00 – 4:00 PM</span>
                <span className="text-[#3B1050] dark:text-[#E2B8D0] tabular-nums">
                  {voteStats.sun34.length} vote{voteStats.sun34.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#E9DCF2] dark:bg-[#2A1D38] overflow-hidden">
                <div
                  className="h-full bg-[#3B1050] dark:bg-[#A8567F] transition-all"
                  style={{
                    width: `${
                      voteStats.total > 0
                        ? Math.round((voteStats.sun34.length / voteStats.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              {voteStats.sun34.length > 0 && (
                <p className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                  {voteStats.sun34.map((v) => v.teacherName).join(', ')}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#1F122B] dark:text-[#F5EEF9]">Sunday 5:00 – 6:00 PM</span>
                <span className="text-[#3B1050] dark:text-[#E2B8D0] tabular-nums">
                  {voteStats.sun56.length} vote{voteStats.sun56.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#E9DCF2] dark:bg-[#2A1D38] overflow-hidden">
                <div
                  className="h-full bg-[#A8567F] transition-all"
                  style={{
                    width: `${
                      voteStats.total > 0
                        ? Math.round((voteStats.sun56.length / voteStats.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              {voteStats.sun56.length > 0 && (
                <p className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                  {voteStats.sun56.map((v) => v.teacherName).join(', ')}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-[#E5D9EC] dark:border-[#332442]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#1F122B] dark:text-[#F5EEF9]">Other Suggested Times</span>
                <span className="text-[#3B1050] dark:text-[#E2B8D0] tabular-nums">
                  {voteStats.other.length}
                </span>
              </div>
              {voteStats.other.length === 0 ? (
                <p className="text-xs text-[#7A6888] dark:text-[#9D8AAD]">
                  No alternative time suggestions yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {voteStats.other.map((v) => (
                    <li
                      key={v.uid}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                          {v.teacherName}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteVote(v.uid)}
                            className="text-[11px] text-red-600 dark:text-red-400 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="font-semibold text-[#1F122B] dark:text-[#F5EEF9]">
                        {v.suggestedTime}
                      </p>
                      {v.note && <p className="text-[#5A4A66] dark:text-[#BBAAC9]">{v.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {weeklyMeetingVotes.some((v) => v.selectedOption !== 'other' && v.note) && (
              <div className="space-y-2 pt-2 border-t border-[#E5D9EC] dark:border-[#332442]">
                <p className="text-xs font-bold text-[#5A4A66] dark:text-[#BBAAC9] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#A8567F]" />
                  Teacher notes
                </p>
                <ul className="space-y-1.5">
                  {weeklyMeetingVotes
                    .filter((v) => v.selectedOption !== 'other' && v.note)
                    .map((v) => (
                      <li key={v.uid} className="text-xs text-[#3A2847] dark:text-[#DFD0EC]">
                        <strong>{v.teacherName}</strong> ({formatWeeklyOptionLabel(v.selectedOption)}
                        ): {v.note}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. WEEKLY MEETING ZOOM LINK, AGENDA TOPICS & LATEST TAKEAWAYS */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F0E6F5] dark:border-[#2E203D] pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <Video className="w-5 h-5 text-[#A8567F]" />
              Weekly Meeting Zoom Room, Agenda &amp; Takeaways
            </h2>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              <strong>Confirmed slot:</strong> {confirmedTimeDisplay}
              {weeklyMeetingInfo?.meetingDateLabel ? ` · ${weeklyMeetingInfo.meetingDateLabel}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {weeklyMeetingInfo?.zoomLink && (
              <a
                href={weeklyMeetingInfo.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold whitespace-nowrap"
              >
                <Video className="w-4 h-4" />
                Join Weekly Zoom
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => (editingInfo ? setEditingInfo(false) : openInfoEditor())}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5] text-xs font-bold whitespace-nowrap"
              >
                {editingInfo ? <X className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                {editingInfo ? 'Close editor' : 'Edit Zoom link & notes'}
              </button>
            )}
          </div>
        </div>

        {/* Admin Zoom Link & Action Notes Editor */}
        {isAdmin && editingInfo && (
          <form
            onSubmit={handleSaveMeetingInfo}
            className="rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#A8567F]/40 p-4 space-y-3"
          >
            <p className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
              Update Weekly Academic Team Meeting Details (Zoom link automatically appears inside
              the 10-minute reminder toast!)
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Confirmed Sunday Slot</label>
                <select
                  value={infoSlot}
                  onChange={(e) =>
                    setInfoSlot(e.target.value as 'sun_3_4_pm' | 'sun_5_6_pm' | 'custom')
                  }
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                >
                  <option value="sun_3_4_pm">Sunday 3:00 – 4:00 PM (MMT)</option>
                  <option value="sun_5_6_pm">Sunday 5:00 – 6:00 PM (MMT)</option>
                  <option value="custom">Custom time label</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Schedule / Next Date Label</label>
                <input
                  type="text"
                  maxLength={120}
                  value={infoDateLabel}
                  onChange={(e) => setInfoDateLabel(e.target.value)}
                  placeholder="e.g., Every Sunday · Next meeting 22 Nov"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
            </div>

            {infoSlot === 'custom' && (
              <div>
                <label className="block text-xs font-semibold mb-1">Custom Meeting Time (MMT)</label>
                <input
                  type="text"
                  maxLength={160}
                  value={infoCustomLabel}
                  onChange={(e) => setInfoCustomLabel(e.target.value)}
                  placeholder="e.g., Saturday 7:00 – 8:00 PM (MMT)"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">Weekly Meeting Zoom Link</label>
              <input
                type="url"
                maxLength={500}
                value={infoZoomLink}
                onChange={(e) => setInfoZoomLink(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Latest Meeting Takeaways &amp; Action Notes
              </label>
              <textarea
                rows={4}
                maxLength={2500}
                value={infoNotes}
                onChange={(e) => setInfoNotes(e.target.value)}
                placeholder="Summarize key decisions, action items, and next steps from our latest Sunday meeting..."
                className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingInfo(false)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#E5D9EC] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingInfo}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold disabled:opacity-50"
              >
                {savingInfo ? 'Saving...' : 'Save meeting details'}
              </button>
            </div>
          </form>
        )}

        <div className="grid lg:grid-cols-12 gap-5 items-start">
          {/* Left: 1-Line Agenda Topics */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-[#A8567F]" />
                Sunday Meeting Agenda Topics ({openAgendaCount} open)
              </h3>
            </div>

            {canInteract && (
              <form
                onSubmit={handleAddAgendaItem}
                className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={300}
                    value={agendaTopic}
                    onChange={(e) => setAgendaTopic(e.target.value)}
                    placeholder="Add a 1-line agenda topic before Sunday's meeting..."
                    className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                  />
                  <button
                    type="submit"
                    disabled={savingAgenda || agendaTopic.trim().length < 3}
                    className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold whitespace-nowrap disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {savingAgenda ? 'Adding...' : 'Add topic'}
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={600}
                  value={agendaDetails}
                  onChange={(e) => setAgendaDetails(e.target.value)}
                  placeholder="Optional short detail (e.g., level or class context)"
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs"
                />
              </form>
            )}

            {meetingAgendaItems.length === 0 ? (
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] py-2">
                No agenda topics added yet. Drop any question, pacing issue, or idea you want to
                discuss with Tr YAO and the team!
              </p>
            ) : (
              <ul className="space-y-2">
                {meetingAgendaItems.map((item) => {
                  const isMine = item.authorUid === user?.uid;
                  return (
                    <li
                      key={item.id}
                      className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                        item.status === 'discussed'
                          ? 'bg-[#FAF7FC]/60 dark:bg-[#160F1F]/60 border-[#E5D9EC] dark:border-[#2E203D] opacity-75'
                          : 'bg-[#FAF7FC] dark:bg-[#160F1F] border-[#E5D9EC] dark:border-[#332442]'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              item.status === 'discussed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-[#3B1050] text-white'
                            }`}
                          >
                            {item.status === 'discussed' ? 'Discussed' : 'Open'}
                          </span>
                          <span className="font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
                            {item.authorName}
                          </span>
                        </div>
                        <p
                          className={`text-sm font-semibold ${
                            item.status === 'discussed'
                              ? 'line-through text-[#5A4A66] dark:text-[#9D8AAD]'
                              : 'text-[#1F122B] dark:text-[#F5EEF9]'
                          }`}
                        >
                          {item.topic}
                        </p>
                        {item.details && (
                          <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                            {item.details}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleAgendaStatus(item)}
                            className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-[11px] font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                          >
                            <Check className="w-3 h-3" />
                            {item.status === 'open' ? 'Done' : 'Reopen'}
                          </button>
                        )}
                        {(isAdmin || isMine) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAgendaItem(item.id)}
                            className="p-1.5 rounded-lg text-[#7A6888] hover:text-red-600 dark:hover:text-red-400"
                            aria-label="Delete agenda item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Right: Latest Meeting Takeaways & Action Notes */}
          <div className="lg:col-span-5 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-4 sm:p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#A8567F]" />
              Latest Meeting Takeaways &amp; Action Notes
            </h3>
            {weeklyMeetingInfo?.latestNotes ? (
              <div className="space-y-2">
                <p className="text-xs sm:text-sm text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed whitespace-pre-line">
                  {weeklyMeetingInfo.latestNotes}
                </p>
                <p className="text-[11px] text-[#7A6888] dark:text-[#9D8AAD]">
                  Updated by {weeklyMeetingInfo.updatedBy}
                  {weeklyMeetingInfo.updatedAt?.toDate?.()
                    ? ` · ${formatLocalDateTime(weeklyMeetingInfo.updatedAt.toDate().toISOString())}`
                    : ''}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed">
                {isAdmin
                  ? 'Click "Edit Zoom link & notes" above after Sunday’s meeting to share key takeaways and next steps here.'
                  : 'Key takeaways and action items from our latest Sunday Academic Team Meeting will appear here.'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 3. BOOK YOUR 1-TO-1 WELCOME MEETING (WITH TR HEIN) */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#A8567F]" />
            Book Your 1-to-1 Welcome Meeting
          </h2>
          <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            A relaxed 15–20 minute chat with Tr Hein (and the Founder where possible) to hear your
            goals and questions. Times shown in <strong>{getViewerTimeZone()}</strong>.
          </p>
        </div>

        {mySlot ? (
          <div className="rounded-2xl bg-[#F4EEF7] dark:bg-[#2A1D38] border border-[#E5D9EC] dark:border-[#3E2D52] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4" />
                Your booked 1-to-1 slot (also shown on Home &amp; My Month 1)
              </p>
              <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                {mySlot.label}
              </h3>
              <p className="text-sm text-[#3B1050] dark:text-[#E8D5F5] tabular-nums">
                {formatLocalDateTime(mySlot.dateTimeIso)} · {mySlot.durationMins} mins
              </p>
              {mySlot.notes && (
                <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                  Your note: {mySlot.notes}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadIcsEvent({
                    title: `YAO 1-to-1: ${mySlot.label}`,
                    startIso: mySlot.dateTimeIso,
                    durationMins: mySlot.durationMins,
                    description: mySlot.notes
                      ? `1-to-1 welcome chat with Tr Hein.\nYour note: ${mySlot.notes}`
                      : '1-to-1 welcome chat with Tr Hein (YAO English Teacher Hub).',
                    location: 'Zoom / Online',
                  })
                }
                className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#A8567F]" />
                Download .ics
              </button>
              <a
                href={getGoogleCalendarUrl({
                  title: `YAO 1-to-1: ${mySlot.label}`,
                  startIso: mySlot.dateTimeIso,
                  durationMins: mySlot.durationMins,
                  description: mySlot.notes
                    ? `1-to-1 welcome chat with Tr Hein.\nYour note: ${mySlot.notes}`
                    : '1-to-1 welcome chat with Tr Hein (YAO English Teacher Hub).',
                  location: 'Zoom / Online',
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] whitespace-nowrap"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-[#A8567F]" />
                Google Calendar
              </a>
              <button
                type="button"
                disabled={busySlotId === mySlot.id}
                onClick={() => handleCancelSlot(mySlot.id)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-red-600 dark:text-red-400 whitespace-nowrap"
              >
                {busySlotId === mySlot.id ? 'Updating...' : 'Cancel / change slot'}
              </button>
            </div>
          </div>
        ) : availableSlots.length === 0 ? (
          <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9] py-4">
            No open 1-to-1 slots right now — Tr Hein will post new slots soon.
          </p>
        ) : (
          <div className="space-y-4">
            {canInteract && (
              <div>
                <label className="block text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9] mb-1">
                  Optional topic you want to mention (before clicking a slot)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="e.g., Ideas for my B1 or IELTS group, or a question about materials"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {availableSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="p-4 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] flex flex-col justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                      {slot.label}
                    </p>
                    <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5 tabular-nums">
                      {formatLocalDateTime(slot.dateTimeIso)} · {slot.durationMins} mins
                    </p>
                  </div>
                  {canInteract && (
                    <button
                      type="button"
                      disabled={busySlotId === slot.id}
                      onClick={() => handleBookSlot(slot.id)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {busySlotId === slot.id ? 'Booking...' : 'Pick this slot'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
