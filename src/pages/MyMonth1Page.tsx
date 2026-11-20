import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  Lock,
  MessageSquare,
  Send,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, emailToKey, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import {
  downloadIcsEvent,
  formatLocalDateTime,
  getGoogleCalendarUrl,
  getViewerTimeZone,
} from '../utils/helpers';
import { notifyAdminOfTeacherAction } from '../utils/notifications';
import type { NavTab, ObservationDoc } from '../types';

interface MyMonth1PageProps {
  onNavigate: (tab: NavTab) => void;
}

export function MyMonth1Page({ onNavigate }: MyMonth1PageProps) {
  const { user, canInteract, myProfile, oneToOneSlots, observations, mySurvey, trainingResponses } = useHub();

  const [bookingNotes, setBookingNotes] = useState('');
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);

  const myEmailKey = user?.email ? emailToKey(user.email) : '';

  const mySlot = useMemo(
    () => (user ? oneToOneSlots.find((s) => s.bookedByUid === user.uid) || null : null),
    [oneToOneSlots, user]
  );

  const availableSlots = useMemo(
    () => oneToOneSlots.filter((s) => !s.bookedByUid),
    [oneToOneSlots]
  );

  // Only show observations belonging to the signed-in teacher on My Month 1 (even if signed in as admin!)
  const myObservations = useMemo(() => {
    if (!user) return [];
    return observations.filter(
      (o) => o.teacherUid === user.uid || (myEmailKey && o.teacherEmailKey === myEmailKey)
    );
  }, [observations, user, myEmailKey]);

  const hasTrainingRsvp = useMemo(
    () => trainingResponses.some((r) => r.uid === user?.uid && r.rsvp === 'going'),
    [trainingResponses, user]
  );

  const checklistItems = [
    {
      key: 'profileDone' as const,
      label: '“Get to know me” team profile completed',
      done: Boolean(myProfile?.onboardingComplete || myProfile?.checklist?.profileDone),
      actionLabel: 'View team card',
      tab: 'team' as NavTab,
    },
    {
      key: 'surveyDone' as const,
      label: 'Month 1 Needs Survey completed',
      done: Boolean(mySurvey || myProfile?.checklist?.surveyDone),
      actionLabel: mySurvey ? 'Update survey' : 'Fill survey',
      tab: 'voice' as NavTab,
    },
    {
      key: 'oneToOneBooked' as const,
      label: 'One-to-one welcome meeting booked (15–20 mins)',
      done: Boolean(mySlot || myProfile?.checklist?.oneToOneBooked),
      actionLabel: '',
      tab: null,
    },
    {
      key: 'observationScheduled' as const,
      label: 'Baseline Zoom class observation scheduled (not a test)',
      done: Boolean(myObservations.length > 0 || myProfile?.checklist?.observationScheduled),
      actionLabel: '',
      tab: null,
    },
    {
      key: 'trainingAttended' as const,
      label: 'Month 1 training sessions RSVP’d / attended',
      done: Boolean(hasTrainingRsvp || myProfile?.checklist?.trainingAttended),
      actionLabel: 'Open training',
      tab: 'training' as NavTab,
    },
  ];

  const completedCount = checklistItems.filter((c) => c.done).length;

  const toggleChecklistFlag = async (key: keyof NonNullable<typeof myProfile>['checklist']) => {
    if (!user || !myProfile || !canInteract) return;
    try {
      await updateDoc(doc(db, 'teachers', user.uid), {
        checklist: {
          ...myProfile.checklist,
          [key]: !myProfile.checklist[key],
        },
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teachers/${user.uid}`);
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
      await notifyAdminOfTeacherAction({
        actorUid: user.uid,
        actorName: myProfile.displayName,
        category: 'meeting_booked',
        title: `${myProfile.displayName} booked a 1-to-1 meeting`,
        message: `${slot?.label || '1-to-1 Chat'} on ${whenLabel}${trimmedNotes ? ` · Note: "${trimmedNotes}"` : ''}`,
        targetTab: 'admin',
        priority: 'important',
      });
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
      await notifyAdminOfTeacherAction({
        actorUid: user.uid,
        actorName: myProfile.displayName,
        category: 'meeting_cancelled',
        title: `${myProfile.displayName} cancelled a 1-to-1 booking`,
        message: `Freed up ${slot?.label || '1-to-1 slot'} on ${whenLabel}.`,
        targetTab: 'admin',
        priority: 'normal',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `oneToOneSlots/${slotId}`);
    } finally {
      setBusySlotId(null);
    }
  };

  const handleSaveObservationReply = async (obs: ObservationDoc) => {
    const replyText = (replyDrafts[obs.id] ?? obs.teacherReply ?? '').trim();
    if (!replyText || !canInteract) return;
    setSavingReplyId(obs.id);
    try {
      await updateDoc(doc(db, 'observations', obs.id), {
        teacherReply: replyText.slice(0, 1500),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `observations/${obs.id}`);
    } finally {
      setSavingReplyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="My Month 1 Personal Space" inShort={PAGE_SUMMARIES.myMonth1} />

      {/* 1. Month 1 Personal Checklist */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              My Month 1 Checklist
            </h2>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Simple milestones to settle in smoothly — tap any item to mark or open it.
            </p>
          </div>
          <span className="text-sm font-bold text-[#3B1050] dark:text-[#E2B8D0] tabular-nums">
            {completedCount} / {checklistItems.length} done
          </span>
        </div>

        <ul className="divide-y divide-[#F0E6F5] dark:divide-[#2E203D]">
          {checklistItems.map((item) => (
            <li
              key={item.key}
              className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
            >
              <button
                type="button"
                onClick={() => toggleChecklistFlag(item.key)}
                className="flex items-center gap-3 text-left min-h-[40px]"
              >
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-[#BBAAC9] shrink-0" />
                )}
                <span
                  className={`text-sm font-medium ${
                    item.done
                      ? 'text-[#5A4A66] dark:text-[#9D8AAD] line-through'
                      : 'text-[#1F122B] dark:text-[#F5EEF9]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
              {item.tab && item.actionLabel && (
                <button
                  type="button"
                  onClick={() => onNavigate(item.tab!)}
                  className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline whitespace-nowrap shrink-0"
                >
                  {item.actionLabel} →
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Book a One-to-One Meeting */}
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
                Your booked slot (also shown on Home)
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
            No open slots right now — Tr Hein will post new 1-to-1 slots soon.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9] mb-1">
                Optional topic you want to mention (before clicking a slot)
              </label>
              <input
                type="text"
                maxLength={300}
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="e.g., Ideas for my B1 group or a question about materials"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>

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

      {/* 3. Class Observation Schedule & Private Feedback */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#A8567F]" />
              My Class Observation & Private Feedback
            </h2>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Purpose: see where we are now and what you need. Not a test.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
            <Lock className="w-3.5 h-3.5" />
            Private: only you, Tr Hein & the Founder
          </span>
        </div>

        {myObservations.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9]">
              No observation scheduled yet
            </p>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Tr Hein will agree your Week 2 baseline observation date with you in advance — never
              a surprise visit.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myObservations.map((obs) => {
              const draft = replyDrafts[obs.id] ?? obs.teacherReply ?? '';
              return (
                <article
                  key={obs.id}
                  className="rounded-2xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        {obs.status === 'scheduled'
                          ? 'Scheduled baseline visit'
                          : obs.status === 'observed'
                            ? 'Observed — feedback chat coming within 2 days'
                            : obs.status === 'feedback_shared'
                              ? 'Private feedback shared'
                              : 'Completed'}
                      </p>
                      <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                        {obs.levelClass}
                      </h3>
                      <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] tabular-nums">
                        Planned date: {formatLocalDateTime(obs.plannedDateIso)}
                      </p>
                    </div>
                    {obs.status === 'scheduled' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            downloadIcsEvent({
                              title: `YAO Class Observation: ${obs.levelClass}`,
                              startIso: obs.plannedDateIso,
                              durationMins: 60,
                              description:
                                obs.purposeNote ||
                                'Baseline Zoom class observation with Tr Hein. Purpose: see where we are now and what you need. Not a test.',
                              location: 'Zoom Class',
                            })
                          }
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                        >
                          <Download className="w-3.5 h-3.5 text-[#A8567F]" />
                          Download .ics
                        </button>
                        <a
                          href={getGoogleCalendarUrl({
                            title: `YAO Class Observation: ${obs.levelClass}`,
                            startIso: obs.plannedDateIso,
                            durationMins: 60,
                            description:
                              obs.purposeNote ||
                              'Baseline Zoom class observation with Tr Hein. Purpose: see where we are now and what you need. Not a test.',
                            location: 'Zoom Class',
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                        >
                          <CalendarPlus className="w-3.5 h-3.5 text-[#A8567F]" />
                          Google Calendar
                        </a>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[#3B1050] dark:text-[#E2B8D0] bg-white dark:bg-[#1F1629] px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442]">
                    {obs.purposeNote || 'Purpose: see where we are now and what you need. Not a test.'}
                  </p>

                  {/* Private Feedback Details */}
                  {(obs.whatWorked || (obs.actions && obs.actions.length > 0)) && (
                    <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-[#E5D9EC] dark:border-[#332442] text-sm">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          What worked well
                        </p>
                        <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                          {obs.whatWorked || 'To be shared in our private chat.'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                          1 or 2 agreed actions
                        </p>
                        {obs.actions && obs.actions.length > 0 ? (
                          <ol className="list-decimal pl-4 space-y-1 text-[#3A2847] dark:text-[#DFD0EC]">
                            {obs.actions.map((act, i) => (
                              <li key={i}>{act}</li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-[#5A4A66] dark:text-[#BBAAC9]">We will agree these together.</p>
                        )}
                      </div>
                      {obs.supportAgreed && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-[#A8567F] dark:text-[#D98EB3]">
                            Support from Tr Hein
                          </p>
                          <p className="text-[#3A2847] dark:text-[#DFD0EC]">{obs.supportAgreed}</p>
                        </div>
                      )}
                      {obs.reviewDate && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-[#5A4A66] dark:text-[#BBAAC9]">
                            Friendly review check-in date
                          </p>
                          <p className="text-[#1F122B] dark:text-[#F5EEF9] font-semibold tabular-nums">
                            {obs.reviewDate}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Teacher's Own Reflection First */}
                  <div className="pt-3 border-t border-[#E5D9EC] dark:border-[#332442] space-y-2">
                    <label className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#A8567F]" />
                      Your own view first (private reply to Tr Hein)
                    </label>
                    <textarea
                      rows={3}
                      maxLength={1500}
                      disabled={obs.status === 'completed'}
                      value={draft}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [obs.id]: e.target.value }))
                      }
                      placeholder="How did the lesson feel to you? What went well, and what would you like help with?"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm disabled:opacity-60"
                    />
                    {obs.status !== 'completed' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={savingReplyId === obs.id || !draft.trim()}
                          onClick={() => handleSaveObservationReply(obs)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {savingReplyId === obs.id ? 'Saving...' : 'Save my private reply'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
