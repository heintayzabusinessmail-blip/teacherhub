import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  FileText,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  MessageCircleQuestion,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  COPY_USE_TOOLS,
  COORDINATOR_JOB_STEPS,
  GOOD_PRACTICE_CARDS,
  JARGON_GLOSSARY,
  ROADMAP_MONTH_1_WEEKS,
  TEACHER_PROMISES,
} from '../content/planContent';
import type { FaqItem, NavTab, ResourceItem } from '../types';

type AssistantTab = 'hub-finder' | 'assistant-coordinator';

interface HubRecommendation {
  id: string;
  sourceType: 'resource' | 'tool' | 'faq' | 'guide';
  title: string;
  level?: string;
  skill?: string;
  type?: string;
  url?: string;
  navTab?: string;
  whyItHelps: string;
}

interface AskHubResponse {
  found: boolean;
  summary: string;
  recommendations: HubRecommendation[];
}

interface PracticeWay {
  title: string;
  howToDoIt: string;
  realExample: string;
}

interface CoordinatorReplyPayload {
  funnyReaction: string;
  frameworkTag: string;
  pedagogyPrinciple: string;
  practiceWays: PracticeWay[];
  questionBack: string;
  quickReplies: string[];
}

interface CoachMessage {
  id: string;
  role: 'teacher' | 'coordinator';
  text?: string;
  reply?: CoordinatorReplyPayload;
}

interface ResourceAssistantsProps {
  approvedResources: ResourceItem[];
  faqs: FaqItem[];
  teacherName: string;
  onOpenResource: (r: ResourceItem) => void;
  onNavigate?: (tab: NavTab) => void;
}

const HUB_STARTER_PROBLEMS = [
  'I need a simple 1-page lesson plan for a 60-minute Zoom class',
  'How do Month 1 class observations work and what gets checked?',
  'My classes are falling behind the coursebook schedule',
  'Students keep asking a tricky grammar question',
];

const COACH_STARTER_PROMPTS = [
  'Students nod "yes" when I ask "Do you understand?" and then freeze on the task',
  'My B1 Zoom breakout rooms turn into awkward silence',
  'I talk too much (high TTT) when explaining Present Perfect vs Past Simple',
  'How do I correct speaking mistakes without killing student confidence?',
];

const FRAMEWORKS = [
  'All (TKT · TESOL · CELTA)',
  'CELTA Practice',
  'Cambridge TKT',
  'TESOL Classroom',
];

const COACH_LEVELS = ['Any level', 'Pre-A1 / A1', 'A2', 'B1', 'B2', 'C1', 'One-to-One'];

export function ResourceAssistants({
  approvedResources,
  faqs,
  teacherName,
  onOpenResource,
  onNavigate,
}: ResourceAssistantsProps) {
  const [activeTab, setActiveTab] = useState<AssistantTab>('hub-finder');

  // --- Ask the Hub (Problem-to-Document Finder) state ---
  const [hubProblem, setHubProblem] = useState('');
  const [hubLoading, setHubLoading] = useState(false);
  const [hubReply, setHubReply] = useState<AskHubResponse | null>(null);
  const [hubError, setHubError] = useState('');
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  // --- Ask Assistant Coordinator (TKT · TESOL · CELTA Coach) state ---
  const [coachFramework, setCoachFramework] = useState(FRAMEWORKS[0]);
  const [coachLevel, setCoachLevel] = useState('Any level');
  const [coachInput, setCoachInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const coachBottomRef = useRef<HTMLDivElement | null>(null);

  // Build unified catalog of ALL YAO Hub documents for Ask the Hub
  const hubDocuments = useMemo(() => {
    const docs: Array<{
      id: string;
      sourceType: 'resource' | 'tool' | 'faq' | 'guide';
      title: string;
      level?: string;
      skill?: string;
      type?: string;
      summary: string;
      url?: string;
      navTab?: NavTab;
    }> = [];

    for (const r of approvedResources) {
      docs.push({
        id: r.id,
        sourceType: 'resource',
        title: r.title,
        level: r.level,
        skill: r.skill,
        type: r.type,
        summary: r.description || `${r.level} ${r.skill} ${r.type} resource in YAO Digital Library.`,
        url: r.url,
        navTab: 'resources',
      });
    }

    for (const t of COPY_USE_TOOLS) {
      docs.push({
        id: t.id,
        sourceType: 'tool',
        title: t.title,
        type: 'Copy & Use Template',
        summary: `${t.purpose} ${t.templateText.slice(0, 320)}`,
        navTab: 'tools',
      });
    }

    for (const f of faqs.filter((x) => x.status === 'answered')) {
      docs.push({
        id: f.id,
        sourceType: 'faq',
        title: f.question,
        level: f.level,
        skill: f.category,
        type: 'Shared FAQ',
        summary: `Explanation: ${f.explanation} Example: ${f.example} Checking question: ${f.checkingQuestion}`,
        navTab: 'voice',
      });
    }

    for (const g of GOOD_PRACTICE_CARDS) {
      docs.push({
        id: `gp-${g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        sourceType: 'guide',
        title: g.title,
        type: 'Good Practice Guide',
        summary: `${g.source}: ${g.idea} How YAO uses it: ${g.howYaoUsesIt}`,
        navTab: 'good-practice',
      });
    }

    for (const w of ROADMAP_MONTH_1_WEEKS) {
      docs.push({
        id: `m1-${w.week.toLowerCase().replace(/\s+/g, '-')}`,
        sourceType: 'guide',
        title: `Month 1 · ${w.week}: ${w.title}`,
        type: 'Month 1 Roadmap',
        summary: `${w.summary} Deliverables: ${w.deliverables.join('; ')}`,
        navTab: 'roadmap',
      });
    }

    docs.push({
      id: 'guide-promises',
      sourceType: 'guide',
      title: 'My Promises to Every Teacher & 9 Academic Coordinator Jobs',
      type: 'About Me & Our Plan',
      summary: `${TEACHER_PROMISES.join(' ')} Coordinator support areas: ${COORDINATOR_JOB_STEPS.map((j) => j.title).join(', ')}.`,
      navTab: 'plan',
    });

    docs.push({
      id: 'guide-glossary',
      sourceType: 'guide',
      title: 'Plain-English ELT Jargon Glossary (CEFR, CELTA, CCQs, ICQs, TTT/STT)',
      type: 'Good Practice Reference',
      summary: JARGON_GLOSSARY.map((j) => `${j.term}: ${j.explanation}`).join(' | ').slice(0, 600),
      navTab: 'good-practice',
    });

    return docs;
  }, [approvedResources, faqs]);

  const runAskHub = async (queryText: string) => {
    const clean = queryText.trim();
    if (!clean) return;
    setHubProblem(clean);
    setHubLoading(true);
    setHubError('');
    setHubReply(null);
    setExpandedToolId(null);

    try {
      const res = await fetch('/api/ask-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: clean,
          documents: hubDocuments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHubError(data.error || 'Ask the Hub could not answer right now.');
      } else {
        setHubReply(data as AskHubResponse);
      }
    } catch {
      setHubError('Could not connect to Ask the Hub. You can still search the library below.');
    } finally {
      setHubLoading(false);
    }
  };

  const handleHubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAskHub(hubProblem);
  };

  const runAskCoordinator = async (textToSend: string) => {
    const clean = textToSend.trim();
    if (!clean || coachLoading) return;

    const teacherMsg: CoachMessage = {
      id: `t-${Date.now()}`,
      role: 'teacher',
      text: clean,
    };

    const historyPayload = coachMessages.map((m) => ({
      role: m.role,
      text:
        m.role === 'teacher'
          ? m.text || ''
          : m.reply
            ? `${m.reply.funnyReaction} [${m.reply.frameworkTag}] ${m.reply.pedagogyPrinciple} Question asked back: ${m.reply.questionBack}`
            : '',
    }));

    setCoachMessages((prev) => [...prev, teacherMsg]);
    setCoachInput('');
    setCoachLoading(true);
    setCoachError('');

    try {
      const res = await fetch('/api/ask-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          framework: coachFramework,
          level: coachLevel,
          teacherName,
          history: historyPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoachError(data.error || 'Assistant Coordinator could not respond right now.');
      } else {
        const replyMsg: CoachMessage = {
          id: `c-${Date.now()}`,
          role: 'coordinator',
          reply: data as CoordinatorReplyPayload,
        };
        setCoachMessages((prev) => [...prev, replyMsg]);
        setTimeout(() => {
          coachBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
      }
    } catch {
      setCoachError('Could not connect to Assistant Coordinator right now. Please try again.');
    } finally {
      setCoachLoading(false);
    }
  };

  const handleCoachSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runAskCoordinator(coachInput);
  };

  const handOffProblemToCoach = (problemText: string) => {
    setActiveTab('assistant-coordinator');
    runAskCoordinator(problemText);
  };

  const sourceTypeLabel = (sourceType: HubRecommendation['sourceType']) => {
    if (sourceType === 'resource') return 'Library Resource';
    if (sourceType === 'tool') return 'Copy & Use Tool';
    if (sourceType === 'faq') return 'Shared FAQ';
    return 'YAO Hub Guide';
  };

  return (
    <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] shadow-sm overflow-hidden">
      {/* Switcher Header */}
      <div className="p-2 bg-[#FAF7FC] dark:bg-[#160F1F] border-b border-[#E5D9EC] dark:border-[#332442] grid sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('hub-finder')}
          className={`min-h-[48px] px-4 py-2.5 rounded-xl text-left transition-all flex items-center gap-3 ${
            activeTab === 'hub-finder'
              ? 'bg-[#3B1050] text-white shadow-xs'
              : 'bg-white dark:bg-[#1F1629] text-[#3B1050] dark:text-[#E8D5F5] border border-[#E5D9EC] dark:border-[#332442] hover:border-[#A8567F]'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              activeTab === 'hub-finder'
                ? 'bg-white/15 text-white'
                : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#A8567F]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Ask the Hub</p>
            <p
              className={`text-[11px] truncate ${
                activeTab === 'hub-finder' ? 'text-white/80' : 'text-[#5A4A66] dark:text-[#BBAAC9]'
              }`}
            >
              Tell us your problem → jump to the right document
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assistant-coordinator')}
          className={`min-h-[48px] px-4 py-2.5 rounded-xl text-left transition-all flex items-center gap-3 ${
            activeTab === 'assistant-coordinator'
              ? 'bg-[#A8567F] text-white shadow-xs'
              : 'bg-white dark:bg-[#1F1629] text-[#3B1050] dark:text-[#E8D5F5] border border-[#E5D9EC] dark:border-[#332442] hover:border-[#A8567F]'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              activeTab === 'assistant-coordinator'
                ? 'bg-white/15 text-white'
                : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#A8567F]'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Ask Assistant Coordinator</p>
            <p
              className={`text-[11px] truncate ${
                activeTab === 'assistant-coordinator'
                  ? 'text-white/85'
                  : 'text-[#5A4A66] dark:text-[#BBAAC9]'
              }`}
            >
              TKT · TESOL · CELTA coach · witty replies &amp; real examples
            </p>
          </div>
        </button>
      </div>

      {/* PANEL 1: ASK THE HUB — PROBLEM-TO-DOCUMENT FINDER */}
      {activeTab === 'hub-finder' && (
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
              Problem → Right YAO Document ({hubDocuments.length} Hub documents indexed)
            </p>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Describe what you are struggling with or looking for. Ask the Hub searches our Resource
              Library, Copy &amp; Use Templates, Shared FAQ, and Hub Guides to hand you the exact
              right document.
            </p>
          </div>

          <form onSubmit={handleHubSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              maxLength={500}
              value={hubProblem}
              onChange={(e) => setHubProblem(e.target.value)}
              placeholder="Describe your problem (e.g., my class is falling behind the syllabus, or need a lesson plan format)..."
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
            <button
              type="submit"
              disabled={hubLoading || !hubProblem.trim()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {hubLoading ? 'Finding document...' : 'Find right document'}
            </button>
          </form>

          {/* Quick Starter Problems */}
          <div className="flex flex-wrap gap-1.5">
            {HUB_STARTER_PROBLEMS.map((starter) => (
              <button
                key={starter}
                type="button"
                disabled={hubLoading}
                onClick={() => runAskHub(starter)}
                className="text-left text-[11px] px-3 py-1.5 rounded-lg bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-[#5A4A66] dark:text-[#C5B4D4] hover:border-[#A8567F] hover:text-[#3B1050] dark:hover:text-white transition-colors"
              >
                “{starter}”
              </button>
            ))}
          </div>

          {hubError && (
            <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3.5 rounded-xl">
              {hubError}
            </div>
          )}

          {hubReply && (
            <div className="rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-4 space-y-4">
              <p className="text-sm text-[#1F122B] dark:text-[#F5EEF9] leading-relaxed">
                {hubReply.summary}
              </p>

              {hubReply.recommendations.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9]">
                    Recommended YAO documents for your problem:
                  </p>
                  <div className="space-y-2.5">
                    {hubReply.recommendations.map((rec) => {
                      const matchingResource =
                        rec.sourceType === 'resource'
                          ? approvedResources.find((r) => r.id === rec.id)
                          : undefined;
                      const matchingTool =
                        rec.sourceType === 'tool'
                          ? COPY_USE_TOOLS.find((t) => t.id === rec.id)
                          : undefined;
                      const isExpandedTool = expandedToolId === rec.id;

                      return (
                        <div
                          key={`${rec.sourceType}-${rec.id}`}
                          className="rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] p-3.5 space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                                <span className="text-[#A8567F] dark:text-[#D98EB3] inline-flex items-center gap-1">
                                  {rec.sourceType === 'resource' ? (
                                    <BookOpen className="w-3.5 h-3.5" />
                                  ) : rec.sourceType === 'faq' ? (
                                    <HelpCircle className="w-3.5 h-3.5" />
                                  ) : (
                                    <FileText className="w-3.5 h-3.5" />
                                  )}
                                  {sourceTypeLabel(rec.sourceType)}
                                </span>
                                {rec.level && (
                                  <span className="text-[#7A6888] dark:text-[#9D8AAD]">
                                    · {rec.level}
                                  </span>
                                )}
                                {rec.skill && (
                                  <span className="text-[#7A6888] dark:text-[#9D8AAD]">
                                    · {rec.skill}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                                {rec.title}
                              </p>
                              <p className="text-xs text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                                {rec.whyItHelps}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {matchingResource && (
                                <a
                                  href={matchingResource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => onOpenResource(matchingResource)}
                                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold whitespace-nowrap"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Open document
                                </a>
                              )}
                              {matchingTool && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedToolId(isExpandedTool ? null : matchingTool.id)
                                  }
                                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#FAF7FC] dark:hover:bg-[#2A1D38] whitespace-nowrap"
                                >
                                  {isExpandedTool ? 'Hide template' : 'Preview here'}
                                </button>
                              )}
                              {!matchingResource && rec.navTab && onNavigate && (
                                <button
                                  type="button"
                                  onClick={() => onNavigate(rec.navTab as NavTab)}
                                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold whitespace-nowrap"
                                >
                                  Go to page
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {matchingTool && isExpandedTool && (
                            <pre className="mt-2 p-3 rounded-lg bg-[#FAF7FC] dark:bg-[#140D1A] border border-[#E5D9EC] dark:border-[#332442] text-xs text-[#1F122B] dark:text-[#DFD0EC] whitespace-pre-wrap font-sans leading-relaxed overflow-x-auto">
                              {matchingTool.templateText}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handOffProblemToCoach(hubProblem)}
                    className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-xs font-semibold"
                  >
                    <GraduationCap className="w-4 h-4" />
                    Ask Assistant Coordinator (TKT · TESOL · CELTA) instead
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {hubReply.recommendations.length > 0 && (
                <div className="pt-2 border-t border-[#E5D9EC] dark:border-[#332442] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                    Want practical TKT / TESOL / CELTA classroom examples for this too?
                  </span>
                  <button
                    type="button"
                    onClick={() => handOffProblemToCoach(hubProblem)}
                    className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3] hover:underline inline-flex items-center gap-1"
                  >
                    Coach me on this with examples
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PANEL 2: ASK ASSISTANT COORDINATOR — TKT · TESOL · CELTA PRACTICE COACH */}
      {activeTab === 'assistant-coordinator' && (
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                Teaching Practice Store · Cambridge TKT · TESOL · CELTA
              </p>
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                Ask any real classroom question — your Assistant Coordinator flips the talking
                ratio in Tr Hein’s witty style, gives you real classroom practice ways with worked
                examples, and tosses a simple coaching question right back so we solve it together.
              </p>
            </div>
            {coachMessages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCoachMessages([]);
                  setCoachError('');
                  setCoachInput('');
                }}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#5A4A66] dark:text-[#C5B4D4] hover:text-[#3B1050] shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New topic
              </button>
            )}
          </div>

          {/* Context Selectors: TKT/TESOL/CELTA Lens + Student Level */}
          <div className="grid sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#5A4A66] dark:text-[#BBAAC9] mb-1">
                Pedagogy lens
              </label>
              <select
                value={coachFramework}
                onChange={(e) => setCoachFramework(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs font-medium"
              >
                {FRAMEWORKS.map((fw) => (
                  <option key={fw} value={fw}>
                    {fw}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5A4A66] dark:text-[#BBAAC9] mb-1">
                Class CEFR level
              </label>
              <select
                value={coachLevel}
                onChange={(e) => setCoachLevel(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs font-medium"
              >
                {COACH_LEVELS.map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversation Thread */}
          {coachMessages.length === 0 ? (
            <div className="rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-4 space-y-3">
              <p className="text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]">
                Try one of these real classroom situations, or type your own below:
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {COACH_STARTER_PROMPTS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={coachLoading}
                    onClick={() => runAskCoordinator(starter)}
                    className="text-left p-3 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs text-[#3B1050] dark:text-[#E8D5F5] hover:border-[#A8567F] transition-colors leading-snug"
                  >
                    “{starter}”
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
              {coachMessages.map((msg, idx) => {
                if (msg.role === 'teacher') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#3B1050] text-white px-4 py-2.5 text-sm leading-relaxed">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70 mb-0.5">
                          {teacherName}
                        </p>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  );
                }

                const r = msg.reply;
                if (!r) return null;
                const isLatest = idx === coachMessages.length - 1;

                return (
                  <div
                    key={msg.id}
                    className="rounded-2xl rounded-bl-sm bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-4 space-y-3.5"
                  >
                    {/* Header & Framework Tag */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] inline-flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-[#A8567F]" />
                        Assistant Coordinator
                      </span>
                      <span className="text-[11px] font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        {r.frameworkTag}
                      </span>
                    </div>

                    {/* Funny Tr-Hein Opener */}
                    <p className="text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] leading-relaxed">
                      {r.funnyReaction}
                    </p>

                    {/* Core TKT / TESOL / CELTA Principle */}
                    <div className="rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] px-3.5 py-2.5 text-xs text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                      <strong className="text-[#3B1050] dark:text-[#E8D5F5]">
                        Why this works:{' '}
                      </strong>
                      {r.pedagogyPrinciple}
                    </div>

                    {/* Real Practice Ways + Worked Examples */}
                    {r.practiceWays.length > 0 && (
                      <div className="space-y-2.5">
                        <p className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] inline-flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-[#A8567F]" />
                          Real classroom practice &amp; examples
                        </p>
                        <div className="space-y-2">
                          {r.practiceWays.map((pw, pIdx) => (
                            <div
                              key={`${msg.id}-pw-${pIdx}`}
                              className="rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] p-3 space-y-1.5"
                            >
                              <p className="text-xs font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                                {pIdx + 1}. {pw.title}
                              </p>
                              <p className="text-xs text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                                {pw.howToDoIt}
                              </p>
                              <div className="rounded-lg bg-[#FAF7FC] dark:bg-[#140D1A] border-l-2 border-[#A8567F] px-3 py-2 text-xs text-[#1F122B] dark:text-[#E8D5F5] leading-relaxed">
                                <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                                  Example in class:{' '}
                                </span>
                                {pw.realExample}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inverted Ratio — Question Back to Teacher */}
                    <div className="rounded-xl bg-[#3B1050]/5 dark:bg-[#A8567F]/15 border border-[#A8567F]/30 p-3.5 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <MessageCircleQuestion className="w-4 h-4 text-[#A8567F] shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[#A8567F] dark:text-[#D98EB3]">
                            Your turn — flip the ratio!
                          </p>
                          <p className="text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9] leading-snug">
                            {r.questionBack}
                          </p>
                        </div>
                      </div>

                      {isLatest && r.quickReplies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {r.quickReplies.map((qr) => (
                            <button
                              key={qr}
                              type="button"
                              disabled={coachLoading}
                              onClick={() => runAskCoordinator(qr)}
                              className="text-left text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-[#1F1629] border border-[#A8567F]/40 text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#A8567F] hover:text-white transition-colors"
                            >
                              {qr}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={coachBottomRef} />
            </div>
          )}

          {coachError && (
            <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3.5 rounded-xl">
              {coachError}
            </div>
          )}

          {/* Always-ready Input Box (for new question OR answering the question back!) */}
          <form onSubmit={handleCoachSubmit} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              maxLength={700}
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              placeholder={
                coachMessages.length > 0
                  ? 'Answer the question back or ask a follow-up...'
                  : 'Ask any TKT / TESOL / CELTA teaching practice question...'
              }
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
            <button
              type="submit"
              disabled={coachLoading || !coachInput.trim()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-sm font-semibold whitespace-nowrap disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {coachLoading
                ? 'Thinking...'
                : coachMessages.length > 0
                  ? 'Reply back'
                  : 'Ask Coach'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
