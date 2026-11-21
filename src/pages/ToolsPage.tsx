import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Lock,
  MessageSquare,
  Send,
  Trash2,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { COPY_USE_TOOLS, PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import { formatLocalDateTime } from '../utils/helpers';
import { notifyAdminOfTeacherAction } from '../utils/notifications';
import { downloadTemplatePdf } from '../utils/pdfExport';
import type { LessonPlanSubmission } from '../types';

const LEVEL_OPTIONS = [
  'Pre-A1 / A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'IELTS',
  'One-to-One',
  'Business English',
  'Young Learners',
];

const WEEK_OPTIONS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5+'];

export function ToolsPage() {
  const { user, isAdmin, canInteract, myProfile, lessonPlans } = useHub();

  // Copy & Use template state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([COPY_USE_TOOLS[0].id]);

  // Weekly Lesson Plan Submission state
  const [lpLevel, setLpLevel] = useState(myProfile?.levels?.[0] || 'B1');
  const [lpClass, setLpClass] = useState('');
  const [lpWeek, setLpWeek] = useState('Week 1');
  const [lpObjective, setLpObjective] = useState('');
  const [lpStages, setLpStages] = useState('');
  const [lpUrl, setLpUrl] = useState('');
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [planSavedMsg, setPlanSavedMsg] = useState('');

  // Admin quick feedback state
  const [planFilter, setPlanFilter] = useState<'all' | 'submitted' | 'reviewed'>('all');
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [savingFeedbackId, setSavingFeedbackId] = useState<string | null>(null);

  const visiblePlans = useMemo(() => {
    if (!isAdmin || planFilter === 'all') return lessonPlans;
    return lessonPlans.filter((p) => p.status === planFilter);
  }, [lessonPlans, isAdmin, planFilter]);

  const unreviewedCount = useMemo(
    () => lessonPlans.filter((p) => p.status === 'submitted').length,
    [lessonPlans]
  );

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleSubmitLessonPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canInteract) return;
    const trimmedClass = lpClass.trim().slice(0, 120);
    const trimmedObj = lpObjective.trim().slice(0, 400);
    if (!trimmedClass || trimmedObj.length < 3) return;

    const teacherName = (
      myProfile?.displayName ||
      user.displayName ||
      user.email?.split('@')[0] ||
      'YAO Teacher'
    ).slice(0, 120);

    setSubmittingPlan(true);
    setPlanSavedMsg('');
    try {
      await addDoc(collection(db, 'lessonPlans'), {
        teacherUid: user.uid,
        teacherName,
        level: lpLevel.slice(0, 40),
        className: trimmedClass,
        weekLabel: lpWeek.slice(0, 60),
        lessonObjective: trimmedObj,
        stagesSummary: lpStages.trim().slice(0, 2000),
        planUrl: lpUrl.trim().slice(0, 600),
        status: 'submitted',
        coordinatorFeedback: '',
        reviewedBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await notifyAdminOfTeacherAction({
        actorUid: user.uid,
        actorName: teacherName,
        category: 'lesson_plan_submitted',
        title: `${teacherName} submitted a ${lpLevel} lesson plan (${lpWeek})`,
        message: `${trimmedClass} — Aim: "${trimmedObj}"`.slice(0, 600),
        targetTab: 'tools',
        priority: 'normal',
      });

      setLpClass('');
      setLpObjective('');
      setLpStages('');
      setLpUrl('');
      setPlanSavedMsg('Lesson plan submitted! Tr Hein will share a quick supportive pointer here.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'lessonPlans');
    } finally {
      setSubmittingPlan(false);
    }
  };

  const handleSaveCoordinatorFeedback = async (plan: LessonPlanSubmission) => {
    if (!isAdmin || !user) return;
    const text = (feedbackDrafts[plan.id] ?? plan.coordinatorFeedback ?? '').trim().slice(0, 1200);
    if (!text) return;
    setSavingFeedbackId(plan.id);
    try {
      await updateDoc(doc(db, 'lessonPlans', plan.id), {
        coordinatorFeedback: text,
        reviewedBy: (myProfile?.displayName || user.displayName || 'Tr Hein Tay Za').slice(0, 120),
        status: 'reviewed',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `lessonPlans/${plan.id}`);
    } finally {
      setSavingFeedbackId(null);
    }
  };

  const handleDeleteLessonPlan = async (planId: string) => {
    if (!canInteract) return;
    try {
      await deleteDoc(doc(db, 'lessonPlans', planId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `lessonPlans/${planId}`);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Lesson Plans & Teaching Tools" inShort={PAGE_SUMMARIES.tools} />

      {/* 1. LIVE WEEKLY LESSON PLAN SUBMISSION & QUICK COORDINATOR FEEDBACK (JOB #3) */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border-2 border-[#A8567F]/40 dark:border-[#6D3A58] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#F0E6F5] dark:border-[#2E203D] pb-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#A8567F] dark:text-[#D98EB3] flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5" />
              Coordinator Job #3 · Weekly Lesson Plan Check
            </p>
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Submit Your Weekly Lesson Plan for Quick Pointers
            </h2>
            <p className="text-xs sm:text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Share your lesson aim, short staging outline, or Google Doc / Slides link directly
              here. Tr Hein replies with 1–2 quick, practical pointers to save you planning time.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] shrink-0">
            <Lock className="w-3.5 h-3.5" />
            Private to you &amp; Tr Hein
          </span>
        </div>

        {/* Submission Form */}
        {canInteract ? (
          <form
            onSubmit={handleSubmitLessonPlan}
            className="rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-4 sm:p-5 space-y-4"
          >
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] mb-1">
                  Level *
                </label>
                <select
                  value={lpLevel}
                  onChange={(e) => setLpLevel(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                >
                  {LEVEL_OPTIONS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] mb-1">
                  Class / Group *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={lpClass}
                  onChange={(e) => {
                    setLpClass(e.target.value);
                    setPlanSavedMsg('');
                  }}
                  placeholder="e.g., B1 Evening Group or IELTS Batch 2"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] mb-1">
                  Week *
                </label>
                <select
                  value={lpWeek}
                  onChange={(e) => setLpWeek(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                >
                  {WEEK_OPTIONS.map((wk) => (
                    <option key={wk} value={wk}>
                      {wk}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] mb-1">
                Main Lesson Objective (What students can DO by the end) *
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={400}
                value={lpObjective}
                onChange={(e) => {
                  setLpObjective(e.target.value);
                  setPlanSavedMsg('');
                }}
                placeholder='e.g., "By the end of the lesson, students can describe a food they like and explain why."'
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9] mb-1">
                Quick Stage &amp; Timing Outline (optional)
              </label>
              <textarea
                rows={3}
                maxLength={2000}
                value={lpStages}
                onChange={(e) => setLpStages(e.target.value)}
                placeholder="e.g., Warm-up (5m) → Vocab & CCQs (15m) → Controlled Practice (15m) → Breakout Room Speaking (20m) → Feedback (5m)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9] mb-1">
                Google Doc / Slides / Drive Link (optional)
              </label>
              <input
                type="url"
                maxLength={600}
                value={lpUrl}
                onChange={(e) => setLpUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
            </div>

            {planSavedMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{planSavedMsg}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submittingPlan || !lpClass.trim() || lpObjective.trim().length < 3}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submittingPlan ? 'Submitting...' : 'Submit lesson plan'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            Registered YAO teachers can submit weekly lesson plans privately to Tr Hein here.
          </div>
        )}

        {/* Submitted Lesson Plans & Quick Coordinator Feedback */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              {isAdmin
                ? `All Submitted Lesson Plans (${lessonPlans.length} total · ${unreviewedCount} awaiting pointer)`
                : `My Submitted Lesson Plans (${lessonPlans.length})`}
            </h3>
            {isAdmin && lessonPlans.length > 0 && (
              <div className="flex items-center gap-1.5">
                {(['all', 'submitted', 'reviewed'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPlanFilter(f)}
                    className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold ${
                      planFilter === f
                        ? 'bg-[#3B1050] text-white'
                        : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'submitted' ? 'Needs pointer' : 'Reviewed'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visiblePlans.length === 0 ? (
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] py-2">
              No lesson plans submitted in this view yet.
            </p>
          ) : (
            <div className="space-y-3">
              {visiblePlans.map((plan) => {
                const createdIso = plan.createdAt?.toDate?.()?.toISOString();
                const draft = feedbackDrafts[plan.id] ?? plan.coordinatorFeedback ?? '';
                const isMine = plan.teacherUid === user?.uid;

                return (
                  <article
                    key={plan.id}
                    className="p-4 rounded-2xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-[#3B1050] text-white font-bold">
                            {plan.level}
                          </span>
                          <span className="font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                            {plan.className}
                          </span>
                          <span className="text-[#7A6888]">· {plan.weekLabel}</span>
                          {isAdmin && (
                            <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                              · {plan.teacherName}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              plan.status === 'reviewed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}
                          >
                            {plan.status === 'reviewed' ? 'Pointer shared' : 'Awaiting pointer'}
                          </span>
                        </div>
                        {createdIso && (
                          <p className="text-[11px] text-[#7A6888] dark:text-[#9D8AAD] tabular-nums">
                            Submitted {formatLocalDateTime(createdIso)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {plan.planUrl && (
                          <a
                            href={plan.planUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                          >
                            Open Doc / Slides
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {(isAdmin || isMine) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLessonPlan(plan.id)}
                            className="p-1.5 rounded-lg text-[#7A6888] hover:text-red-600 dark:hover:text-red-400"
                            aria-label="Delete lesson plan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <p className="text-[#1F122B] dark:text-[#F5EEF9]">
                        <strong className="text-xs uppercase tracking-wide text-[#3B1050] dark:text-[#E2B8D0] mr-1.5">
                          Aim:
                        </strong>
                        {plan.lessonObjective}
                      </p>
                      {plan.stagesSummary && (
                        <p className="text-xs sm:text-sm text-[#3A2847] dark:text-[#DFD0EC] whitespace-pre-line bg-white dark:bg-[#1F1629] p-3 rounded-xl border border-[#E5D9EC] dark:border-[#332442]">
                          {plan.stagesSummary}
                        </p>
                      )}
                    </div>

                    {/* Coordinator Feedback Box */}
                    {plan.coordinatorFeedback && !isAdmin && (
                      <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Quick pointer from {plan.reviewedBy || 'Tr Hein'}
                        </p>
                        <p className="text-sm text-emerald-950 dark:text-emerald-100 whitespace-pre-line">
                          {plan.coordinatorFeedback}
                        </p>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="pt-2 border-t border-[#E5D9EC] dark:border-[#332442] space-y-2">
                        <label className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-[#A8567F]" />
                          Quick supportive pointer (1–2 practical tips)
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <textarea
                            rows={2}
                            maxLength={1200}
                            value={draft}
                            onChange={(e) =>
                              setFeedbackDrafts((prev) => ({ ...prev, [plan.id]: e.target.value }))
                            }
                            placeholder="e.g., Great objective! Consider a 5-min timer on warm-up and 1 quick ICQ before breakout rooms."
                            className="flex-1 px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs sm:text-sm"
                          />
                          <button
                            type="button"
                            disabled={savingFeedbackId === plan.id || !draft.trim()}
                            onClick={() => handleSaveCoordinatorFeedback(plan)}
                            className="min-h-[42px] sm:self-end inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-xs font-bold whitespace-nowrap disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {savingFeedbackId === plan.id
                              ? 'Saving...'
                              : plan.coordinatorFeedback
                                ? 'Update pointer'
                                : 'Send pointer'}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 2. COPY & USE READY-MADE TEMPLATES */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] px-1">
          Copy &amp; Download Ready-Made YAO Templates
        </h2>
        {COPY_USE_TOOLS.map((tool) => {
          const isOpen = openIds.includes(tool.id);
          const isCopied = copiedId === tool.id;
          return (
            <article
              key={tool.id}
              className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] overflow-hidden shadow-sm"
            >
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                    {tool.title}
                  </h3>
                  <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">{tool.purpose}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(tool.id, tool.templateText)}
                    className={`min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      isCopied
                        ? 'bg-emerald-700 text-white'
                        : 'bg-[#3B1050] hover:bg-[#4E1869] text-white'
                    }`}
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? 'Copied!' : 'Copy template'}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTemplatePdf(tool.title, tool.purpose, tool.templateText)}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#FAF7FC] dark:hover:bg-[#2A1D38] whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 text-[#A8567F]" />
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleOpen(tool.id)}
                    className="min-h-[42px] inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                  >
                    {isOpen ? (
                      <>
                        Hide <ChevronUp className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Preview <ChevronDown className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-[#F0E6F5] dark:border-[#2E203D]">
                  <pre className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#140D1A] border border-[#E5D9EC] dark:border-[#332442] text-xs sm:text-sm text-[#1F122B] dark:text-[#DFD0EC] whitespace-pre-wrap font-sans leading-relaxed overflow-x-auto">
                    {tool.templateText}
                  </pre>
                  <p className="text-[11px] text-[#7A6888] dark:text-[#9D8AAD] mt-2">
                    Note: All names and numbers inside these templates are fictional examples ready
                    for you to paste into Google Docs or Sheets.
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
