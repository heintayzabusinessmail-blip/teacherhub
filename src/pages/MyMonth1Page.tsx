import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Circle,
  ClipboardEdit,
  Download,
  Eye,
  Lock,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, emailToKey, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import { downloadIcsEvent, formatLocalDateTime, getGoogleCalendarUrl } from '../utils/helpers';
import { notifyAdminOfTeacherAction } from '../utils/notifications';
import { formatWeeklyOptionLabel } from './MeetingsPage';
import type { NavTab, ObservationDoc, WeeklyCheckinMood } from '../types';

interface MyMonth1PageProps {
  onNavigate: (tab: NavTab) => void;
}

const WEEK_OPTIONS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5+'];

const MOOD_OPTIONS: Array<{
  id: WeeklyCheckinMood;
  label: string;
  badgeClass: string;
}> = [
  {
    id: 'going_well',
    label: 'Going well',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60',
  },
  {
    id: 'okay',
    label: 'Managing okay',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60',
  },
  {
    id: 'need_support',
    label: 'Need support',
    badgeClass:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/60',
  },
];

export function MyMonth1Page({ onNavigate }: MyMonth1PageProps) {
  const {
    user,
    canInteract,
    myProfile,
    oneToOneSlots,
    observations,
    mySurvey,
    trainingResponses,
    myWeeklyCheckins,
    weeklyMeetingVotes,
  } = useHub();

  // Weekly Feedback & Challenges form state
  const [weekLabel, setWeekLabel] = useState('Week 1');
  const [mood, setMood] = useState<WeeklyCheckinMood>('going_well');
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [checkinSavedMsg, setCheckinSavedMsg] = useState('');

  // Observation reply drafts
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);

  const myEmailKey = user?.email ? emailToKey(user.email) : '';

  const mySlot = useMemo(
    () => (user ? oneToOneSlots.find((s) => s.bookedByUid === user.uid) || null : null),
    [oneToOneSlots, user]
  );

  const myWeeklyVote = useMemo(
    () => (user ? weeklyMeetingVotes.find((v) => v.uid === user.uid) || null : null),
    [weeklyMeetingVotes, user]
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
      actionLabel: 'Open Meetings',
      tab: 'meetings' as NavTab,
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

  const handleSubmitWeeklyCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !myProfile || !canInteract) return;
    const trimmedChallenges = challenges.trim().slice(0, 1200);
    if (!trimmedChallenges) return;

    const trimmedWins = wins.trim().slice(0, 800);
    const teacherName = myProfile.displayName.slice(0, 120);
    setSavingCheckin(true);
    setCheckinSavedMsg('');

    try {
      await addDoc(collection(db, 'teachers', user.uid, 'weeklyCheckins'), {
        uid: user.uid,
        teacherName,
        weekLabel: weekLabel.slice(0, 60),
        mood,
        wins: trimmedWins,
        challenges: trimmedChallenges,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const moodLabel = MOOD_OPTIONS.find((m) => m.id === mood)?.label || mood;
      await notifyAdminOfTeacherAction({
        actorUid: user.uid,
        actorName: teacherName,
        category: 'weekly_feedback',
        title: `${teacherName} submitted ${weekLabel} feedback (${moodLabel})`,
        message: `${trimmedChallenges}${trimmedWins ? `\nWin: ${trimmedWins}` : ''}`.slice(0, 600),
        targetTab: 'admin',
        priority: mood === 'need_support' ? 'important' : 'normal',
      });

      setWins('');
      setChallenges('');
      setCheckinSavedMsg(`Saved your ${weekLabel} feedback under your profile!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `teachers/${user.uid}/weeklyCheckins`);
    } finally {
      setSavingCheckin(false);
    }
  };

  const handleDeleteCheckin = async (checkinId: string) => {
    if (!user || !canInteract) return;
    try {
      await deleteDoc(doc(db, 'teachers', user.uid, 'weeklyCheckins', checkinId));
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `teachers/${user.uid}/weeklyCheckins/${checkinId}`
      );
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

      {/* 2. Weekly Feedback & Challenges Form (stored under /teachers/{uid}/weeklyCheckins) */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <ClipboardEdit className="w-5 h-5 text-[#A8567F]" />
              Weekly Feedback &amp; Challenges
            </h2>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Share quick weekly feedback, class challenges, or materials you need — saved privately
              under your teacher profile for you and Tr Hein.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
            <Lock className="w-3.5 h-3.5" />
            Private to you &amp; Tr Hein
          </span>
        </div>

        {canInteract && myProfile ? (
          <form
            onSubmit={handleSubmitWeeklyCheckin}
            className="rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-4 sm:p-5 space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                  Which week?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEK_OPTIONS.map((wk) => (
                    <button
                      key={wk}
                      type="button"
                      onClick={() => setWeekLabel(wk)}
                      className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-semibold border transition-colors ${
                        weekLabel === wk
                          ? 'bg-[#3B1050] text-white border-[#3B1050]'
                          : 'bg-white dark:bg-[#1F1629] text-[#3A2847] dark:text-[#DFD0EC] border-[#E5D9EC] dark:border-[#332442]'
                      }`}
                    >
                      {wk}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                  How did this week feel?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMood(m.id)}
                      className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-semibold border transition-colors ${
                        mood === m.id
                          ? 'bg-[#A8567F] text-white border-[#A8567F]'
                          : 'bg-white dark:bg-[#1F1629] text-[#3A2847] dark:text-[#DFD0EC] border-[#E5D9EC] dark:border-[#332442]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                Weekly feedback, challenges, or support needed *
              </label>
              <textarea
                rows={3}
                required
                maxLength={1200}
                value={challenges}
                onChange={(e) => {
                  setChallenges(e.target.value);
                  setCheckinSavedMsg('');
                }}
                placeholder="e.g., My B1 students struggled with listening speed, or I need extra IELTS Writing Task 2 sample essays..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9]">
                What went well this week? (optional)
              </label>
              <input
                type="text"
                maxLength={800}
                value={wins}
                onChange={(e) => setWins(e.target.value)}
                placeholder="e.g., Breakout room speaking activity worked really nicely!"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
            </div>

            {checkinSavedMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{checkinSavedMsg}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingCheckin || !challenges.trim()}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {savingCheckin ? 'Submitting...' : 'Submit weekly feedback'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            Registered YAO teachers can submit weekly feedback and challenges under their profile here.
          </div>
        )}

        {/* Teacher's Own Submitted Weekly Feedback History */}
        {myWeeklyCheckins.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              My Saved Weekly Feedback ({myWeeklyCheckins.length})
            </h3>
            <div className="space-y-2.5">
              {myWeeklyCheckins.map((entry) => {
                const moodDef =
                  MOOD_OPTIONS.find((m) => m.id === entry.mood) || MOOD_OPTIONS[0];
                const createdIso = entry.createdAt?.toDate?.()?.toISOString();
                return (
                  <article
                    key={entry.id}
                    className="p-4 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                          {entry.weekLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${moodDef.badgeClass}`}
                        >
                          {moodDef.label}
                        </span>
                        {createdIso && (
                          <span className="text-[11px] text-[#7A6888] dark:text-[#9D8AAD] tabular-nums">
                            · {formatLocalDateTime(createdIso)}
                          </span>
                        )}
                      </div>
                      {canInteract && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCheckin(entry.id)}
                          className="p-1.5 rounded-lg text-[#7A6888] hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Delete weekly feedback entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-[#1F122B] dark:text-[#F5EEF9] leading-relaxed whitespace-pre-line">
                      {entry.challenges}
                    </p>
                    {entry.wins && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        <strong>Went well:</strong> {entry.wins}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 3. Meetings Quick Summary Card (links cleanly to the separate Meetings tab) */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#A8567F]" />
            Weekly Academic Team Meeting &amp; 1-to-1 Booking
          </h2>
          <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            <strong>Tr YAO Weekly Team Meeting:</strong>{' '}
            {myWeeklyVote
              ? formatWeeklyOptionLabel(myWeeklyVote.selectedOption, myWeeklyVote.suggestedTime)
              : 'Not chosen yet (Sunday 3–4 PM / 5–6 PM MMT or suggest another time)'}
          </p>
          <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            <strong>1-to-1 Welcome Meeting:</strong>{' '}
            {mySlot
              ? `${mySlot.label} (${formatLocalDateTime(mySlot.dateTimeIso)})`
              : 'Not booked yet'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('meetings')}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          Open Meetings tab
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* 4. Class Observation Schedule & Private Feedback */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#A8567F]" />
              My Class Observation &amp; Private Feedback
            </h2>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Purpose: see where we are now and what you need. Not a test.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
            <Lock className="w-3.5 h-3.5" />
            Private: only you, Tr Hein &amp; the Founder
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
                    {obs.purposeNote ||
                      'Purpose: see where we are now and what you need. Not a test.'}
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
                          <p className="text-[#5A4A66] dark:text-[#BBAAC9]">
                            We will agree these together.
                          </p>
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
