import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Download,
  ExternalLink,
  GraduationCap,
  MessageSquare,
  Plus,
  Send,
  Star,
  Trash2,
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
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import {
  downloadIcsEvent,
  formatLocalDateTime,
  getEmbedPreviewUrl,
  getGoogleCalendarUrl,
  getViewerTimeZone,
} from '../utils/helpers';
import type { TrainingSession } from '../types';

export function TrainingPage() {
  const { user, isAdmin, canInteract, myProfile, trainingSessions, trainingResponses } = useHub();

  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');
  const [feedbackOpenId, setFeedbackOpenId] = useState<string | null>(null);
  const [fbUseful, setFbUseful] = useState(5);
  const [fbClear, setFbClear] = useState(5);
  const [fbComment, setFbComment] = useState('');

  const [reflectionDrafts, setReflectionDrafts] = useState<Record<string, string>>({});
  const [videoOpenId, setVideoOpenId] = useState<string | null>(null);

  // Admin session editor
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [sTitle, setSTitle] = useState('');
  const [sMonth, setSMonth] = useState(1);
  const [sDateTime, setSDateTime] = useState('');
  const [sDuration, setSDuration] = useState(60);
  const [sPresenter, setSPresenter] = useState('Tr Hein Tay Za');
  const [sTopic, setSTopic] = useState('');
  const [sZoom, setSZoom] = useState('');
  const [sMaterials, setSMaterials] = useState('');
  const [sRecording, setSRecording] = useState('');
  const [sTryTask, setSTryTask] = useState('');
  const [sStatus, setSStatus] = useState<'upcoming' | 'completed'>('upcoming');
  const [savingSession, setSavingSession] = useState(false);

  const viewerTz = getViewerTimeZone();

  const filteredSessions = useMemo(() => {
    if (monthFilter === 'all') return trainingSessions;
    return trainingSessions.filter((s) => s.month === monthFilter);
  }, [trainingSessions, monthFilter]);

  const getMyResponse = (sessionId: string) =>
    trainingResponses.find((r) => r.sessionId === sessionId && r.uid === user?.uid);

  const upsertTrainingResponse = async (
    sessionId: string,
    patch: Partial<{
      rsvp: 'going' | 'cannot_come' | '';
      feedbackUseful: number;
      feedbackClear: number;
      feedbackComment: string;
      reflection: string;
    }>
  ) => {
    if (!user || !canInteract) return;
    const id = `${sessionId}_${user.uid}`;
    const existing = getMyResponse(sessionId);
    try {
      await setDoc(doc(db, 'trainingResponses', id), {
        sessionId,
        uid: user.uid,
        teacherName: (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120),
        rsvp: patch.rsvp ?? existing?.rsvp ?? '',
        feedbackUseful: patch.feedbackUseful ?? existing?.feedbackUseful ?? 0,
        feedbackClear: patch.feedbackClear ?? existing?.feedbackClear ?? 0,
        feedbackComment: (patch.feedbackComment ?? existing?.feedbackComment ?? '').slice(0, 400),
        reflection: (patch.reflection ?? existing?.reflection ?? '').slice(0, 400),
        isSample: false,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `trainingResponses/${id}`);
    }
  };

  const openSessionModal = (session?: TrainingSession) => {
    if (session) {
      setEditingSession(session);
      setSTitle(session.title);
      setSMonth(session.month);
      setSDateTime(session.dateTimeIso.slice(0, 16));
      setSDuration(session.durationMins);
      setSPresenter(session.presenter);
      setSTopic(session.topic);
      setSZoom(session.zoomLink);
      setSMaterials(session.materialsUrl);
      setSRecording(session.recordingUrl);
      setSTryTask(session.tryThisWeek);
      setSStatus(session.status);
    } else {
      setEditingSession(null);
      setSTitle('');
      setSMonth(1);
      setSDateTime(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 16));
      setSDuration(60);
      setSPresenter('Tr Hein Tay Za');
      setSTopic('');
      setSZoom('');
      setSMaterials('');
      setSRecording('');
      setSTryTask('');
      setSStatus('upcoming');
    }
    setShowSessionForm(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sTitle.trim() || !sDateTime) return;
    setSavingSession(true);
    try {
      const iso = new Date(sDateTime).toISOString();
      const now = serverTimestamp();
      if (editingSession) {
        await updateDoc(doc(db, 'trainingSessions', editingSession.id), {
          title: sTitle.trim().slice(0, 180),
          month: Math.max(1, Math.min(6, Number(sMonth) || 1)),
          dateTimeIso: iso,
          durationMins: Math.max(5, Math.min(480, Number(sDuration) || 60)),
          presenter: sPresenter.trim().slice(0, 120) || 'Tr Hein Tay Za',
          topic: sTopic.trim().slice(0, 200) || sTitle.trim().slice(0, 200),
          zoomLink: sZoom.trim().slice(0, 500),
          materialsUrl: sMaterials.trim().slice(0, 500),
          recordingUrl: sRecording.trim().slice(0, 500),
          tryThisWeek: sTryTask.trim().slice(0, 500),
          status: sStatus,
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, 'trainingSessions'), {
          title: sTitle.trim().slice(0, 180),
          month: Math.max(1, Math.min(6, Number(sMonth) || 1)),
          dateTimeIso: iso,
          durationMins: Math.max(5, Math.min(480, Number(sDuration) || 60)),
          presenter: sPresenter.trim().slice(0, 120) || 'Tr Hein Tay Za',
          topic: sTopic.trim().slice(0, 200) || sTitle.trim().slice(0, 200),
          zoomLink: sZoom.trim().slice(0, 500),
          materialsUrl: sMaterials.trim().slice(0, 500),
          recordingUrl: sRecording.trim().slice(0, 500),
          tryThisWeek: sTryTask.trim().slice(0, 500),
          status: sStatus,
          isSample: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      setShowSessionForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'trainingSessions');
    } finally {
      setSavingSession(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'trainingSessions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `trainingSessions/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Training & 6-Month Topic Calendar"
        inShort={PAGE_SUMMARIES.training}
        action={
          isAdmin && (
            <button
              type="button"
              onClick={() => openSessionModal()}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add session
            </button>
          )
        }
      />

      {/* Timezone Notice & Month Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMonthFilter('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
              monthFilter === 'all'
                ? 'bg-[#3B1050] text-white'
                : 'bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[#3B1050] dark:text-[#E8D5F5]'
            }`}
          >
            All 6 Months
          </button>
          {[1, 2, 3, 4, 5, 6].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonthFilter(m)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold tabular-nums ${
                monthFilter === m
                  ? 'bg-[#3B1050] text-white'
                  : 'bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[#3B1050] dark:text-[#E8D5F5]'
              }`}
            >
              Month {m}
            </button>
          ))}
        </div>

        <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#A8567F]" />
          Times shown in your time zone: <strong className="text-[#1F122B] dark:text-white">{viewerTz}</strong>
        </p>
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-10 text-center space-y-2">
          <GraduationCap className="w-8 h-8 text-[#BBAAC9] mx-auto" />
          <p className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
            No training sessions scheduled for this filter yet
          </p>
          <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
            Month 1 includes two practical workshops led by Tr Hein. Later months are adjusted after
            our Month 1 review.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredSessions.map((session) => {
            const responses = trainingResponses.filter((r) => r.sessionId === session.id);
            const goingCount = responses.filter((r) => r.rsvp === 'going').length;
            const reflections = responses.filter((r) => r.reflection.trim().length > 0);
            const myRes = getMyResponse(session.id);
            const embedRec = getEmbedPreviewUrl(session.recordingUrl);
            const isFbOpen = feedbackOpenId === session.id;

            return (
              <article
                key={session.id}
                className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <p className="text-xs text-[#7A6888] dark:text-[#9D8AAD] tabular-nums">
                      <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        Month {session.month}
                      </span>
                      {' · '}
                      {formatLocalDateTime(session.dateTimeIso)}
                      {' · '}
                      {session.durationMins} mins
                      {' · '}
                      Led by {session.presenter}
                    </p>
                    <h2 className="text-lg sm:text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                      {session.title}
                    </h2>
                    <p className="text-sm text-[#5A4A66] dark:text-[#C5B4D4]">{session.topic}</p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openSessionModal(session)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(session.id)}
                        className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                        aria-label="Delete session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Links + RSVP Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F0E6F5] dark:border-[#2E203D]">
                  <div className="flex flex-wrap items-center gap-2">
                    {session.zoomLink && (
                      <a
                        href={session.zoomLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Join Zoom
                      </a>
                    )}
                    {session.materialsUrl && (
                      <a
                        href={session.materialsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Workshop materials
                      </a>
                    )}
                    {session.recordingUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setVideoOpenId(videoOpenId === session.id ? null : session.id)
                        }
                        className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        {videoOpenId === session.id ? 'Hide recording' : 'Watch recording'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        downloadIcsEvent({
                          title: `YAO Training: ${session.title}`,
                          startIso: session.dateTimeIso,
                          durationMins: session.durationMins,
                          description: [
                            session.topic,
                            `Led by ${session.presenter}`,
                            session.zoomLink ? `Zoom: ${session.zoomLink}` : '',
                          ]
                            .filter(Boolean)
                            .join('\n'),
                          location: session.zoomLink || 'Zoom / Online',
                        })
                      }
                      className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#FAF7FC] dark:hover:bg-[#2A1D38] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A8567F]" />
                      Download .ics
                    </button>
                    <a
                      href={getGoogleCalendarUrl({
                        title: `YAO Training: ${session.title}`,
                        startIso: session.dateTimeIso,
                        durationMins: session.durationMins,
                        description: [
                          session.topic,
                          `Led by ${session.presenter}`,
                          session.zoomLink ? `Zoom: ${session.zoomLink}` : '',
                        ]
                          .filter(Boolean)
                          .join('\n'),
                        location: session.zoomLink || 'Zoom / Online',
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#FAF7FC] dark:hover:bg-[#2A1D38] transition-colors"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-[#A8567F]" />
                      Google Calendar
                    </a>
                  </div>

                  {/* RSVP Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] tabular-nums">
                      {goingCount} going
                    </span>
                    {canInteract && (
                      <>
                        <button
                          type="button"
                          onClick={() => upsertTrainingResponse(session.id, { rsvp: 'going' })}
                          className={`min-h-[40px] inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            myRes?.rsvp === 'going'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Going
                        </button>
                        <button
                          type="button"
                          onClick={() => upsertTrainingResponse(session.id, { rsvp: 'cannot_come' })}
                          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            myRes?.rsvp === 'cannot_come'
                              ? 'bg-[#A8567F] text-white'
                              : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#5A4A66] dark:text-[#BBAAC9]'
                          }`}
                        >
                          Cannot come
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isFbOpen) {
                              setFeedbackOpenId(null);
                            } else {
                              setFbUseful(myRes?.feedbackUseful || 5);
                              setFbClear(myRes?.feedbackClear || 5);
                              setFbComment(myRes?.feedbackComment || '');
                              setFeedbackOpenId(session.id);
                            }
                          }}
                          className="min-h-[40px] inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold"
                        >
                          <Star className="w-3.5 h-3.5 text-[#A8567F]" />
                          {myRes?.feedbackUseful ? 'Edit feedback' : '3-question feedback'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Recording Preview */}
                {videoOpenId === session.id && session.recordingUrl && (
                  <div className="rounded-xl overflow-hidden border border-[#E5D9EC] dark:border-[#332442]">
                    {embedRec.kind === 'iframe' ? (
                      <iframe
                        src={embedRec.src}
                        title={`Recording of ${session.title}`}
                        className="w-full aspect-video"
                        allowFullScreen
                      />
                    ) : (
                      <div className="p-4 text-sm">
                        <a
                          href={session.recordingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#3B1050] dark:text-[#E2B8D0] font-semibold underline"
                        >
                          Open recording in new tab →
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* 3-Question Post-Session Feedback Form */}
                {isFbOpen && (
                  <div className="p-4 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-3">
                    <h3 className="text-sm font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                      Quick 3-Question Feedback (After Session)
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <label className="space-y-1">
                        <span className="font-semibold block">
                          1. How useful was this for your real Zoom classes? ({fbUseful}/5)
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={fbUseful}
                          onChange={(e) => setFbUseful(Number(e.target.value))}
                          className="w-full accent-[#3B1050]"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="font-semibold block">
                          2. How clear and easy to follow was the workshop? ({fbClear}/5)
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={fbClear}
                          onChange={(e) => setFbClear(Number(e.target.value))}
                          className="w-full accent-[#A8567F]"
                        />
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        3. One thing you liked or want us to improve next time
                      </label>
                      <input
                        type="text"
                        maxLength={400}
                        value={fbComment}
                        onChange={(e) => setFbComment(e.target.value)}
                        placeholder="Short, honest note..."
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setFeedbackOpenId(null)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E5D9EC] text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await upsertTrainingResponse(session.id, {
                            feedbackUseful: fbUseful,
                            feedbackClear: fbClear,
                            feedbackComment: fbComment,
                          });
                          setFeedbackOpenId(null);
                        }}
                        className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#3B1050] text-white text-xs font-semibold"
                      >
                        Save feedback
                      </button>
                    </div>
                  </div>
                )}

                {/* Try This Week Task + One-Line Reflection */}
                {session.tryThisWeek && (
                  <div className="p-4 rounded-2xl bg-[#F4EEF7] dark:bg-[#2A1D38] space-y-3">
                    <div>
                      <p className="text-xs font-bold text-[#A8567F] dark:text-[#D98EB3]">
                        Try This Week
                      </p>
                      <p className="text-sm text-[#1F122B] dark:text-[#F5EEF9] mt-0.5 leading-relaxed">
                        {session.tryThisWeek}
                      </p>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const text = (reflectionDrafts[session.id] ?? myRes?.reflection ?? '').trim();
                        if (!text) return;
                        await upsertTrainingResponse(session.id, { reflection: text });
                        setReflectionDrafts((prev) => ({ ...prev, [session.id]: '' }));
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        maxLength={400}
                        value={reflectionDrafts[session.id] ?? myRes?.reflection ?? ''}
                        onChange={(e) =>
                          setReflectionDrafts((prev) => ({
                            ...prev,
                            [session.id]: e.target.value,
                          }))
                        }
                        placeholder="Share a one-line reflection after trying it in class..."
                        className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#3E2D52] bg-white dark:bg-[#1F1629] text-sm"
                      />
                      <button
                        type="submit"
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Post
                      </button>
                    </form>

                    {reflections.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-[#E5D9EC] dark:border-[#3E2D52]">
                        <p className="text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9] flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Team Reflections ({reflections.length})
                        </p>
                        {reflections.map((ref) => (
                          <p
                            key={ref.id}
                            className="text-xs sm:text-sm text-[#3A2847] dark:text-[#DFD0EC]"
                          >
                            <strong className="text-[#3B1050] dark:text-[#E2B8D0]">
                              {ref.teacherName}:{' '}
                            </strong>
                            {ref.reflection}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Admin Add / Edit Session Modal */}
      {isAdmin && showSessionForm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowSessionForm(false)}
        >
          <form
            onSubmit={handleSaveSession}
            onClick={(e) => e.stopPropagation()}
            className="max-w-xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                {editingSession ? 'Edit Training Session' : 'Add Training Session'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSessionForm(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Session title *</label>
                <input
                  type="text"
                  required
                  maxLength={180}
                  value={sTitle}
                  onChange={(e) => setSTitle(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Month (1–6)</label>
                  <select
                    value={sMonth}
                    onChange={(e) => setSMonth(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6].map((m) => (
                      <option key={m} value={m}>
                        Month {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Date & time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={sDateTime}
                    onChange={(e) => setSDateTime(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={sDuration}
                    onChange={(e) => setSDuration(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm tabular-nums"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Led by</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={sPresenter}
                    onChange={(e) => setSPresenter(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Status</label>
                  <select
                    value={sStatus}
                    onChange={(e) => setSStatus(e.target.value as 'upcoming' | 'completed')}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Topic summary</label>
                <input
                  type="text"
                  maxLength={200}
                  value={sTopic}
                  onChange={(e) => setSTopic(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">Zoom link</label>
                  <input
                    type="url"
                    value={sZoom}
                    onChange={(e) => setSZoom(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Materials link</label>
                  <input
                    type="url"
                    value={sMaterials}
                    onChange={(e) => setSMaterials(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Recording link</label>
                  <input
                    type="url"
                    value={sRecording}
                    onChange={(e) => setSRecording(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">“Try this week” task</label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={sTryTask}
                  onChange={(e) => setSTryTask(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSessionForm(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5D9EC] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSession}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
              >
                {savingSession ? 'Saving...' : 'Save session'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
