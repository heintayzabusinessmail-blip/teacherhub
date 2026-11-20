import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  GraduationCap,
  HeartHandshake,
  MessageCircle,
  Pin,
  Sparkles,
  Users,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import { downloadIcsEvent, formatLocalDateTime } from '../utils/helpers';
import type { NavTab } from '../types';

interface HomePageProps {
  onNavigate: (tab: NavTab) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const {
    user,
    isAdmin,
    myProfile,
    teachers,
    hubConfig,
    helloFeed,
    trainingSessions,
    oneToOneSlots,
    observations,
    mySurvey,
  } = useHub();

  const [editingPinned, setEditingPinned] = useState(false);
  const [pinnedTitle, setPinnedTitle] = useState('');
  const [pinnedBody, setPinnedBody] = useState('');
  const [savingPinned, setSavingPinned] = useState(false);

  const displayName = myProfile?.displayName || user?.displayName || 'Teacher';
  const pinned = hubConfig['pinned'];
  const spotlight = hubConfig['spotlight'];
  const progressConfig = hubConfig['progress'];

  // 1. Next Training Session
  const nextTraining = useMemo(() => {
    const now = Date.now();
    const upcoming = trainingSessions.filter(
      (s) => s.status === 'upcoming' && new Date(s.dateTimeIso).getTime() >= now - 86400000
    );
    return upcoming[0] || trainingSessions[0] || null;
  }, [trainingSessions]);

  // 2. My One-to-One Slot
  const mySlot = useMemo(() => {
    if (!user) return null;
    return oneToOneSlots.find((s) => s.bookedByUid === user.uid) || null;
  }, [oneToOneSlots, user]);

  // 3. Next Task Due
  const nextTask = useMemo(() => {
    if (!myProfile?.onboardingComplete) {
      return {
        label: 'Complete your “Get to know me” profile card',
        cta: 'Open Team profile',
        tab: 'team' as NavTab,
      };
    }
    if (!mySurvey) {
      return {
        label: 'Fill in the short Month 1 Needs Survey (2 mins)',
        cta: 'Open Needs Survey',
        tab: 'voice' as NavTab,
      };
    }
    if (!mySlot) {
      return {
        label: 'Pick a 15–20 min 1-to-1 welcome meeting slot',
        cta: 'Book a slot',
        tab: 'my-month-1' as NavTab,
      };
    }
    const pendingFeedbackObs = observations.find(
      (o) => o.status === 'feedback_shared' && !o.teacherReply
    );
    if (pendingFeedbackObs) {
      return {
        label: 'Read your private observation feedback & share your view',
        cta: 'Open My Month 1',
        tab: 'my-month-1' as NavTab,
      };
    }
    if (nextTraining?.tryThisWeek) {
      return {
        label: `Try this week: ${nextTraining.tryThisWeek}`,
        cta: 'Open Training',
        tab: 'training' as NavTab,
      };
    }
    return {
      label: 'All Month 1 essentials are up to date — explore the Resource Library!',
      cta: 'Open Library',
      tab: 'resources' as NavTab,
    };
  }, [myProfile, mySurvey, mySlot, observations, nextTraining]);

  // Team Month 1 progress percentage
  const teamProgress = useMemo(() => {
    if (teachers.length === 0) {
      return { percent: progressConfig?.percent ?? 0, completedChecks: 0, totalChecks: 0 };
    }
    let completed = 0;
    const total = teachers.length * 5;
    for (const t of teachers) {
      if (t.checklist?.profileDone || t.onboardingComplete) completed++;
      if (t.checklist?.surveyDone) completed++;
      if (t.checklist?.oneToOneBooked) completed++;
      if (t.checklist?.observationScheduled) completed++;
      if (t.checklist?.trainingAttended) completed++;
    }
    const computed = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      percent: progressConfig?.percent !== undefined ? Math.max(computed, progressConfig.percent) : computed,
      completedChecks: completed,
      totalChecks: total,
    };
  }, [teachers, progressConfig]);

  const startEditPinned = () => {
    setPinnedTitle(pinned?.title || 'Welcome to Month 1 at YAO English!');
    setPinnedBody(pinned?.body || '');
    setEditingPinned(true);
  };

  const handleSavePinned = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPinned(true);
    try {
      await setDoc(doc(db, 'hubConfig', 'pinned'), {
        kind: 'pinned',
        title: pinnedTitle.trim().slice(0, 180) || 'Note from Tr Hein',
        body: pinnedBody.trim().slice(0, 1200),
        updatedBy: displayName,
        updatedAt: serverTimestamp(),
      });
      setEditingPinned(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'hubConfig/pinned');
    } finally {
      setSavingPinned(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${displayName}`}
        inShort={PAGE_SUMMARIES.home}
      />

      {/* Pinned Message from Tr Hein */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
            <Pin className="w-4 h-4 shrink-0" />
            <span>Pinned note from Tr Hein</span>
          </div>
          {isAdmin && !editingPinned && (
            <button
              type="button"
              onClick={startEditPinned}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] bg-[#F4EEF7] dark:bg-[#2C1E38] hover:bg-[#E8DCF0] dark:hover:bg-[#3A274A] transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit note
            </button>
          )}
        </div>

        {editingPinned ? (
          <form onSubmit={handleSavePinned} className="space-y-3">
            <input
              type="text"
              required
              maxLength={180}
              value={pinnedTitle}
              onChange={(e) => setPinnedTitle(e.target.value)}
              placeholder="Headline for your pinned note"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm font-semibold"
            />
            <textarea
              rows={3}
              required
              maxLength={1200}
              value={pinnedBody}
              onChange={(e) => setPinnedBody(e.target.value)}
              placeholder="Write a warm, short update for all YAO teachers..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingPinned}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
              >
                {savingPinned ? 'Saving...' : 'Save pinned note'}
              </button>
              <button
                type="button"
                onClick={() => setEditingPinned(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : pinned ? (
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">{pinned.title}</h2>
            <p className="text-sm sm:text-base text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed whitespace-pre-line">
              {pinned.body}
            </p>
            <p className="text-xs text-[#7A6888] dark:text-[#9D8AAD] pt-1">
              Updated by {pinned.updatedBy}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
            No pinned message yet. {isAdmin ? 'Click “Edit note” to welcome the team.' : 'Tr Hein will post our Month 1 welcome note here soon.'}
          </p>
        )}
      </section>

      {/* Your Next Three Things */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
          Your next three things
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {/* 1. Next Training Session */}
          <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                <GraduationCap className="w-4 h-4" />
                <span>1. Next training session</span>
              </div>
              {nextTraining ? (
                <>
                  <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] leading-snug">
                    {nextTraining.title}
                  </h3>
                  <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] tabular-nums">
                    {formatLocalDateTime(nextTraining.dateTimeIso)} · {nextTraining.durationMins} mins
                  </p>
                  <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                    Led by {nextTraining.presenter}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
                  No training session scheduled yet. Month 1 will have two sessions led by Tr Hein.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onNavigate('training')}
                className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
              >
                View training & RSVP <ArrowRight className="w-4 h-4" />
              </button>
              {nextTraining && (
                <button
                  type="button"
                  onClick={() =>
                    downloadIcsEvent({
                      title: `YAO Training: ${nextTraining.title}`,
                      startIso: nextTraining.dateTimeIso,
                      durationMins: nextTraining.durationMins,
                      description: `${nextTraining.topic}\nLed by ${nextTraining.presenter}`,
                      location: nextTraining.zoomLink || 'Zoom / Online',
                    })
                  }
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#FAF7FC] dark:hover:bg-[#2A1D38]"
                >
                  <Download className="w-3.5 h-3.5 text-[#A8567F]" />
                  Save .ics
                </button>
              )}
            </div>
          </div>

          {/* 2. Your 1-to-1 Meeting Slot */}
          <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                <CalendarClock className="w-4 h-4" />
                <span>2. Your 1-to-1 meeting slot</span>
              </div>
              {mySlot ? (
                <>
                  <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] leading-snug">
                    {mySlot.label}
                  </h3>
                  <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] tabular-nums">
                    {formatLocalDateTime(mySlot.dateTimeIso)} · {mySlot.durationMins} mins
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    Booked and confirmed
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                    Not booked yet
                  </h3>
                  <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
                    Pick a friendly 15–20 minute chat slot with Tr Hein (and the Founder where possible).
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onNavigate('my-month-1')}
                className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
              >
                {mySlot ? 'Manage my slot' : 'Pick a 1-to-1 slot'} <ArrowRight className="w-4 h-4" />
              </button>
              {mySlot && (
                <button
                  type="button"
                  onClick={() =>
                    downloadIcsEvent({
                      title: `YAO 1-to-1: ${mySlot.label}`,
                      startIso: mySlot.dateTimeIso,
                      durationMins: mySlot.durationMins,
                      description: mySlot.notes
                        ? `1-to-1 welcome chat with Tr Hein.\nYour note: ${mySlot.notes}`
                        : '1-to-1 welcome chat with Tr Hein.',
                      location: 'Zoom / Online',
                    })
                  }
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#FAF7FC] dark:hover:bg-[#2A1D38]"
                >
                  <Download className="w-3.5 h-3.5 text-[#A8567F]" />
                  Save .ics
                </button>
              )}
            </div>
          </div>

          {/* 3. Next Task Due */}
          <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                <CheckCircle2 className="w-4 h-4" />
                <span>3. Next step for you</span>
              </div>
              <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] leading-snug">
                {nextTask.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(nextTask.tab)}
              className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
            >
              {nextTask.cta} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Month 1 Team Progress Bar */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Month 1 Progress (Whole Team)
            </h2>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              {progressConfig?.body ||
                'Tracking profiles, Needs Surveys, 1-to-1 chats, baseline observations, and workshops together.'}
            </p>
          </div>
          <span className="text-2xl font-bold text-[#3B1050] dark:text-[#E2B8D0] tabular-nums">
            {teamProgress.percent}%
          </span>
        </div>

        <div
          className="w-full h-3 rounded-full bg-[#F4EEF7] dark:bg-[#2C1E38] overflow-hidden"
          role="progressbar"
          aria-valuenow={teamProgress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Month 1 team progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#3B1050] to-[#A8567F] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(4, teamProgress.percent))}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
          <span className="tabular-nums">
            {teachers.length} teacher profile{teachers.length === 1 ? '' : 's'} active ·{' '}
            {teamProgress.completedChecks}/{teamProgress.totalChecks} Month 1 checklist steps done
          </span>
          <button
            type="button"
            onClick={() => onNavigate('roadmap')}
            className="font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
          >
            See full Month 1 roadmap
          </button>
        </div>
      </section>

      {/* Spotlight & Team Hello Feed */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Teacher of the Week Spotlight */}
        <section className="lg:col-span-5 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
            <Sparkles className="w-4 h-4" />
            <span>Teacher of the Week Spotlight</span>
          </div>
          {spotlight?.body ? (
            <div className="space-y-2">
              {spotlight.teacherName && (
                <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                  {spotlight.teacherName}
                </h3>
              )}
              <p className="text-sm text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                {spotlight.body}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Tr Hein will highlight a teammate’s great lesson idea or kind moment here each week.
            </p>
          )}
          <button
            type="button"
            onClick={() => onNavigate('team')}
            className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
          >
            <Users className="w-4 h-4" />
            Meet the whole team
          </button>
        </section>

        {/* Recent Say Hello & Icebreaker Feed */}
        <section className="lg:col-span-7 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
              <HeartHandshake className="w-4 h-4" />
              <span>Team Hellos & Icebreaker Answers</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('team')}
              className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
            >
              Say hello →
            </button>
          </div>

          {helloFeed.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <MessageCircle className="w-7 h-7 text-[#BBAAC9] mx-auto" />
              <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
                No team greetings yet. Visit “Meet the Team” to say hello to a colleague!
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5D9EC] dark:divide-[#332442]">
              {helloFeed.slice(0, 5).map((post) => (
                <li key={post.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#7A6888] dark:text-[#9D8AAD]">
                    <span className="font-semibold text-[#1F122B] dark:text-[#F5EEF9]">
                      {post.authorName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {post.type === 'icebreaker'
                        ? 'Answered the weekly icebreaker'
                        : `Said hello to ${post.targetName || 'the team'}`}
                    </span>
                  </div>
                  <p className="text-sm text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                    {post.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
