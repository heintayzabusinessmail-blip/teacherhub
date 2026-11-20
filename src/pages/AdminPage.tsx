import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Eye,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  MessageSquare,
  Plus,
  Shield,
  Target,
  Trash2,
  UserPlus,
  Users,
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
  emailToKey,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { useHub } from '../context/HubContext';
import { ADMIN_TARGETS, PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import { formatLocalDateTime } from '../utils/helpers';
import { downloadMonth1ReportPdf } from '../utils/pdfExport';
import { clearAllSampleData, seedFictionalSampleData } from '../utils/seedData';
import type { ObservationDoc, UserRole } from '../types';

type AdminSubTab =
  | 'overview'
  | 'submissions'
  | 'allowlist'
  | 'slots'
  | 'observations'
  | 'surveys'
  | 'report';

export function AdminPage() {
  const {
    user,
    isPrimaryOwner,
    isAdmin,
    myProfile,
    allowlist,
    teachers,
    helloFeed,
    resources,
    allResourceStates,
    trainingSessions,
    trainingResponses,
    oneToOneSlots,
    observations,
    allSurveys,
    faqs,
    suggestions,
    syllabusEntries,
    hasSampleData,
  } = useHub();

  const [subTab, setSubTab] = useState<AdminSubTab>('overview');

  // Allowlist form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('teacher');
  const [savingAllow, setSavingAllow] = useState(false);

  // 1-to-1 Slot form
  const [slotLabel, setSlotLabel] = useState('Week 1 Welcome 1-to-1 (with Tr Hein)');
  const [slotDateTime, setSlotDateTime] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16)
  );
  const [slotDuration, setSlotDuration] = useState(20);
  const [savingSlot, setSavingSlot] = useState(false);

  // Observation form
  const [obsEmail, setObsEmail] = useState('');
  const [obsName, setObsName] = useState('');
  const [obsClass, setObsClass] = useState('B1 Group');
  const [obsDate, setObsDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)
  );
  const [editingObs, setEditingObs] = useState<ObservationDoc | null>(null);
  const [fbWorked, setFbWorked] = useState('');
  const [fbAction1, setFbAction1] = useState('');
  const [fbAction2, setFbAction2] = useState('');
  const [fbSupport, setFbSupport] = useState('');
  const [fbReviewDate, setFbReviewDate] = useState('');
  const [fbStatus, setFbStatus] = useState<ObservationDoc['status']>('feedback_shared');
  const [savingObs, setSavingObs] = useState(false);

  // Printable Report Custom Notes (no student names!)
  const [reportSupportNote, setReportSupportNote] = useState(
    '2 learners in A2 evening group benefit from slower audio replay and vocabulary recap (coordinated with Student Support Coordinator — no personal student data stored).'
  );
  const [reportNextSteps, setReportNextSteps] = useState(
    '1. Complete audio & slide gap fixes for B1/B2.\n2. Start brief weekly lesson plan reviews in Month 2.\n3. Schedule Month 2 focus workshops based on Needs Survey.'
  );

  // Seed / Clear Sample Data
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');
  const [resolvingGapId, setResolvingGapId] = useState<string | null>(null);

  const flaggedGaps = useMemo(
    () =>
      syllabusEntries.filter(
        (s) => s.status === 'needs_materials' || s.materialsGap.trim().length > 0
      ),
    [syllabusEntries]
  );

  const pendingResources = useMemo(
    () => resources.filter((r) => !r.approved),
    [resources]
  );

  const resourceRatingComments = useMemo(
    () => allResourceStates.filter((s) => s.ratingComment && s.ratingComment.trim().length > 0),
    [allResourceStates]
  );

  const totalSubmissionsCount =
    teachers.length +
    trainingResponses.length +
    faqs.length +
    pendingResources.length +
    syllabusEntries.length +
    helloFeed.length;

  const resourceStats = useMemo(() => {
    const bookmarkCounts: Record<string, number> = {};
    allResourceStates.forEach((s) => {
      if (s.bookmarked) bookmarkCounts[s.resourceId] = (bookmarkCounts[s.resourceId] || 0) + 1;
    });
    const approved = resources.filter((r) => r.approved);
    const mostOpened = [...approved].sort((a, b) => (b.openCount || 0) - (a.openCount || 0)).slice(0, 5);
    const mostBookmarked = [...approved]
      .map((r) => ({ ...r, bmCount: bookmarkCounts[r.id] || 0 }))
      .sort((a, b) => b.bmCount - a.bmCount)
      .slice(0, 5);
    return { mostOpened, mostBookmarked };
  }, [resources, allResourceStates]);

  const surveyTopicTally = useMemo(() => {
    const counts: Record<string, number> = {};
    allSurveys.forEach((s) => {
      (s.helpTopics || []).forEach((topic) => {
        counts[topic] = (counts[topic] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allSurveys]);

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-8 text-center space-y-2">
        <Shield className="w-8 h-8 text-[#A8567F] mx-auto" />
        <h1 className="text-lg font-bold">Admin Dashboard Only</h1>
        <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
          This page is only visible to Tr Hein and the Founder.
        </p>
      </div>
    );
  }

  const handleAddAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEmail.trim()) return;
    setSavingAllow(true);
    try {
      const cleanEmail = newEmail.trim().toLowerCase();
      const id = emailToKey(cleanEmail);
      const now = serverTimestamp();
      await setDoc(doc(db, 'allowlist', id), {
        email: cleanEmail.slice(0, 200),
        role: newRole,
        displayName: (newName.trim() || cleanEmail.split('@')[0]).slice(0, 120),
        addedBy: user.uid,
        isSample: false,
        createdAt: now,
        updatedAt: now,
      });
      setNewEmail('');
      setNewName('');
      setNewRole('teacher');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'allowlist');
    } finally {
      setSavingAllow(false);
    }
  };

  const handleChangeRole = async (id: string, nextRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'allowlist', id), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `allowlist/${id}`);
    }
  };

  const handleDeleteAllowlist = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'allowlist', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `allowlist/${id}`);
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotDateTime) return;
    setSavingSlot(true);
    try {
      const now = serverTimestamp();
      await addDoc(collection(db, 'oneToOneSlots'), {
        dateTimeIso: new Date(slotDateTime).toISOString(),
        durationMins: Math.max(10, Math.min(90, Number(slotDuration) || 20)),
        label: slotLabel.trim().slice(0, 120) || '1-to-1 Welcome Meeting',
        bookedByUid: '',
        bookedByName: '',
        notes: '',
        isSample: false,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'oneToOneSlots');
    } finally {
      setSavingSlot(false);
    }
  };

  const handleCreateObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsEmail.trim() || !obsDate) return;
    setSavingObs(true);
    try {
      const emailKey = emailToKey(obsEmail);
      const matchedAllow = allowlist.find((a) => a.id === emailKey);
      const matchedTeacher = teachers.find(
        (t) => matchedAllow && t.displayName.toLowerCase() === matchedAllow.displayName.toLowerCase()
      );
      const now = serverTimestamp();
      await addDoc(collection(db, 'observations'), {
        teacherUid: matchedTeacher?.uid || '',
        teacherEmailKey: emailKey,
        teacherName: (obsName.trim() || matchedAllow?.displayName || obsEmail.split('@')[0]).slice(
          0,
          120
        ),
        levelClass: obsClass.trim().slice(0, 100),
        plannedDateIso: new Date(obsDate).toISOString(),
        status: 'scheduled',
        purposeNote: 'Purpose: see where we are now and what you need. Not a test.',
        whatWorked: '',
        actions: [],
        supportAgreed: '',
        reviewDate: '',
        teacherReply: '',
        isSample: false,
        createdAt: now,
        updatedAt: now,
      });
      setObsEmail('');
      setObsName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'observations');
    } finally {
      setSavingObs(false);
    }
  };

  const openEditObsFeedback = (obs: ObservationDoc) => {
    setEditingObs(obs);
    setFbWorked(obs.whatWorked || '');
    setFbAction1(obs.actions?.[0] || '');
    setFbAction2(obs.actions?.[1] || '');
    setFbSupport(obs.supportAgreed || '');
    setFbReviewDate(obs.reviewDate || '');
    setFbStatus(obs.status === 'scheduled' ? 'feedback_shared' : obs.status);
  };

  const handleSaveObsFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingObs) return;
    setSavingObs(true);
    try {
      const actionsList = [fbAction1.trim(), fbAction2.trim()].filter(Boolean).slice(0, 2);
      await updateDoc(doc(db, 'observations', editingObs.id), {
        whatWorked: fbWorked.trim().slice(0, 1500),
        actions: actionsList,
        supportAgreed: fbSupport.trim().slice(0, 800),
        reviewDate: fbReviewDate.trim().slice(0, 60),
        status: fbStatus,
        updatedAt: serverTimestamp(),
      });
      setEditingObs(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `observations/${editingObs.id}`);
    } finally {
      setSavingObs(false);
    }
  };

  const handleSeed = async () => {
    if (!user || !user.email) return;
    setSeedBusy(true);
    setSeedMessage('');
    try {
      await seedFictionalSampleData(
        user.uid,
        user.email,
        myProfile?.displayName || user.displayName || 'Tr Hein Tay Za'
      );
      setSeedMessage('Fictional sample data loaded across all pages.');
    } finally {
      setSeedBusy(false);
    }
  };

  const handleClearSample = async () => {
    setSeedBusy(true);
    setSeedMessage('');
    try {
      const count = await clearAllSampleData();
      setSeedMessage(`Deleted ${count} sample records. Real accounts and data were kept safe.`);
    } finally {
      setSeedBusy(false);
    }
  };

  const handleResolveGap = async (entryId: string, currentStatus: string) => {
    setResolvingGapId(entryId);
    try {
      await updateDoc(doc(db, 'syllabusEntries', entryId), {
        materialsGap: '',
        status: currentStatus === 'needs_materials' ? 'on_track' : currentStatus,
        updatedByName: (myProfile?.displayName || user?.displayName || 'Tr Hein').slice(0, 120),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `syllabusEntries/${entryId}`);
    } finally {
      setResolvingGapId(null);
    }
  };

  const handleApproveResource = async (resourceId: string) => {
    try {
      await updateDoc(doc(db, 'resources', resourceId), {
        approved: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${resourceId}`);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    try {
      await deleteDoc(doc(db, 'resources', resourceId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `resources/${resourceId}`);
    }
  };

  const answeredFaqCount = faqs.filter((f) => f.status === 'answered').length;
  const bookedSlotsCount = oneToOneSlots.filter((s) => Boolean(s.bookedByUid)).length;
  const obsCompletedCount = observations.filter((o) => o.status !== 'scheduled').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard (Coordinator & Founder)"
        inShort={PAGE_SUMMARIES.admin}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {hasSampleData ? (
              <button
                type="button"
                disabled={seedBusy}
                onClick={handleClearSample}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-300 dark:border-red-900 bg-white dark:bg-[#1F1629] text-xs font-semibold text-red-700 dark:text-red-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {seedBusy ? 'Cleaning...' : 'Delete all sample data'}
              </button>
            ) : (
              <button
                type="button"
                disabled={seedBusy}
                onClick={handleSeed}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-xs font-semibold"
              >
                <Database className="w-3.5 h-3.5" />
                {seedBusy ? 'Loading...' : 'Load fictional sample data'}
              </button>
            )}
          </div>
        }
      />

      {seedMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-800 dark:text-emerald-200 font-medium no-print">
          {seedMessage}
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] no-print">
        {(
          [
            { id: 'overview', label: 'Progress & Targets' },
            { id: 'submissions', label: `Teacher Submissions (${totalSubmissionsCount})` },
            { id: 'surveys', label: `Surveys (${allSurveys.length}) & Box (${suggestions.length})` },
            { id: 'slots', label: `1-to-1 Slots (${oneToOneSlots.length})` },
            { id: 'observations', label: `Observations (${observations.length})` },
            { id: 'allowlist', label: `Edit Access & Roles (${allowlist.length})` },
            { id: 'report', label: 'One-Page M1 Report' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === tab.id
                ? 'bg-[#3B1050] text-white'
                : 'text-[#5A4A66] dark:text-[#C5B4D4] hover:bg-[#F4EEF7] dark:hover:bg-[#2A1D38]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Overview, Resource Usage & Targets */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { label: 'Profiles done', value: `${teachers.filter((t) => t.onboardingComplete).length}/${teachers.length}` },
              { label: 'Surveys done', value: `${allSurveys.length}` },
              { label: '1-to-1s booked', value: `${bookedSlotsCount}/${oneToOneSlots.length}` },
              { label: 'Observations', value: `${obsCompletedCount}/${observations.length}` },
              { label: 'Training RSVPs', value: `${trainingResponses.filter((r) => r.rsvp === 'going').length}` },
              { label: 'Syllabus gaps', value: `${flaggedGaps.length}` },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-4 shadow-xs"
              >
                <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">{kpi.label}</p>
                <p className="text-2xl font-bold text-[#3B1050] dark:text-[#E8D5F5] mt-1 tabular-nums">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* Flagged Materials Gaps from Live Syllabus Tracker */}
          <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#A8567F]" />
                  Flagged Materials Gaps ({flaggedGaps.length})
                </h2>
                <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                  Live alerts submitted by teachers in the Weekly Syllabus Tracker ({syllabusEntries.length} total class updates).
                </p>
              </div>
            </div>

            {flaggedGaps.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                No unresolved materials gaps right now.
              </p>
            ) : (
              <div className="space-y-2.5">
                {flaggedGaps.map((gap) => (
                  <div
                    key={gap.id}
                    className="p-4 rounded-xl bg-[#FCEEF5] dark:bg-[#3A1B2E]/60 border border-[#A8567F]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#8B2C5C] dark:text-[#F0A8CB]">
                        {gap.levelName} · {gap.className} · {gap.weekLabel} ({gap.teacherName})
                      </p>
                      <p className="text-sm text-[#1F122B] dark:text-[#F5EEF9]">
                        {gap.materialsGap || `Needs materials for ${gap.plannedUnit}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={resolvingGapId === gap.id}
                      onClick={() => handleResolveGap(gap.id, gap.status)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold whitespace-nowrap self-start sm:self-center disabled:opacity-60"
                    >
                      {resolvingGapId === gap.id ? 'Updating...' : 'Mark resolved'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Resource Usage */}
          <div className="grid md:grid-cols-2 gap-5">
            <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#A8567F]" />
                Most Opened Resources
              </h2>
              {resourceStats.mostOpened.length === 0 ? (
                <p className="text-xs text-[#5A4A66]">No resources tracked yet.</p>
              ) : (
                <ul className="divide-y divide-[#F0E6F5] dark:divide-[#2E203D] text-sm">
                  {resourceStats.mostOpened.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                      <span className="truncate">{r.title}</span>
                      <span className="text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0] tabular-nums shrink-0">
                        {r.openCount || 0} opens
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#A8567F]" />
                Most Bookmarked Resources
              </h2>
              {resourceStats.mostBookmarked.length === 0 ? (
                <p className="text-xs text-[#5A4A66]">No bookmarks yet.</p>
              ) : (
                <ul className="divide-y divide-[#F0E6F5] dark:divide-[#2E203D] text-sm">
                  {resourceStats.mostBookmarked.map((r) => (
                    <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                      <span className="truncate">{r.title}</span>
                      <span className="text-xs font-bold text-[#A8567F] dark:text-[#D98EB3] tabular-nums shrink-0">
                        {r.bmCount} saved
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Academic Targets View */}
          <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <Target className="w-5 h-5 text-[#A8567F]" />
              Academic Coordinator Targets
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ADMIN_TARGETS.map((target) => (
                <div
                  key={target.id}
                  className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-1.5"
                >
                  <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#A8567F] shrink-0 mt-0.5" />
                    <span>{target.title}</span>
                  </p>
                  <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed">
                    {target.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 1B: Live Teacher Submissions Hub */}
      {subTab === 'submissions' && (
        <div className="space-y-6">
          {/* 1. Teacher Profiles Joined */}
          <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#A8567F]" />
                Teacher Profiles Submitted ({teachers.length})
              </h2>
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                Live record of every teacher who signed in and completed their profile.
              </p>
            </div>
            {teachers.length === 0 ? (
              <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">No teacher profiles submitted yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {teachers.map((t) => {
                  const doneCount = Object.values(t.checklist || {}).filter(Boolean).length;
                  return (
                    <div
                      key={t.uid}
                      className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                          {t.displayName}
                        </p>
                        <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3] tabular-nums">
                          Checklist {doneCount}/5
                        </span>
                      </div>
                      <p className="text-[#5A4A66] dark:text-[#BBAAC9]">
                        <strong>Levels:</strong> {(t.levels || []).join(', ') || '—'} ·{' '}
                        <strong>Experience:</strong> {t.yearsTeaching} yrs
                      </p>
                      {t.classesTaught && (
                        <p>
                          <strong>Classes:</strong> {t.classesTaught}
                        </p>
                      )}
                      {t.goodAt && (
                        <p>
                          <strong>Strengths:</strong> {t.goodAt}
                        </p>
                      )}
                      {t.wantHelpWith && (
                        <p>
                          <strong>Wants help with:</strong> {t.wantHelpWith}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. Training RSVPs, Ratings & Weekly Reflections */}
          <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#A8567F]" />
                Training RSVPs, Workshop Ratings & Reflections ({trainingResponses.length})
              </h2>
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                Every RSVP, usefulness/clarity score, comment, and “Try this week” reflection submitted by teachers.
              </p>
            </div>
            {trainingResponses.length === 0 ? (
              <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
                No training RSVPs or reflections submitted yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {trainingResponses.map((resp) => {
                  const sessionTitle =
                    trainingSessions.find((s) => s.id === resp.sessionId)?.title || resp.sessionId;
                  return (
                    <div
                      key={resp.id}
                      className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-xs space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                          {resp.teacherName}{' '}
                          <span className="font-normal text-[#5A4A66] dark:text-[#BBAAC9]">
                            · {sessionTitle}
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          {resp.rsvp && (
                            <span
                              className={`font-semibold ${
                                resp.rsvp === 'going'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {resp.rsvp === 'going' ? 'Going' : 'Cannot attend'}
                            </span>
                          )}
                          {(resp.feedbackUseful > 0 || resp.feedbackClear > 0) && (
                            <span className="font-semibold text-[#3B1050] dark:text-[#E2B8D0] tabular-nums">
                              Useful {resp.feedbackUseful}/5 · Clear {resp.feedbackClear}/5
                            </span>
                          )}
                        </div>
                      </div>
                      {resp.feedbackComment && (
                        <p>
                          <strong>Workshop feedback:</strong> {resp.feedbackComment}
                        </p>
                      )}
                      {resp.reflection && (
                        <p>
                          <strong>Weekly reflection:</strong> {resp.reflection}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. Pending Resource Suggestions & Teacher Rating Comments */}
          <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#A8567F]" />
                Teacher-Suggested Resources Pending Approval ({pendingResources.length})
              </h2>
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                Approve resources suggested by teachers so they appear in the shared Resource Library.
              </p>
            </div>
            {pendingResources.length === 0 ? (
              <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
                No pending resource suggestions right now.
              </p>
            ) : (
              <div className="space-y-2.5">
                {pendingResources.map((res) => (
                  <div
                    key={res.id}
                    className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                        {res.title}{' '}
                        <span className="font-normal text-[#A8567F] dark:text-[#D98EB3]">
                          ({res.level} · {res.skill} · {res.type})
                        </span>
                      </p>
                      <p className="text-[#5A4A66] dark:text-[#BBAAC9]">
                        Suggested by <strong>{res.addedBy}</strong>
                        {res.description ? ` — ${res.description}` : ''}
                      </p>
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#3B1050] dark:text-[#E2B8D0] font-semibold hover:underline"
                      >
                        Open link <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveResource(res.id)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteResource(res.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resourceRatingComments.length > 0 && (
              <div className="pt-4 border-t border-[#E5D9EC] dark:border-[#332442] space-y-2">
                <h3 className="text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                  Teacher Resource Feedback Comments ({resourceRatingComments.length})
                </h3>
                {resourceRatingComments.map((st) => {
                  const rTitle = resources.find((r) => r.id === st.resourceId)?.title || st.resourceId;
                  const tName = teachers.find((t) => t.uid === st.uid)?.displayName || 'Teacher';
                  return (
                    <div
                      key={st.id}
                      className="p-3 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] text-xs"
                    >
                      <strong>{tName}</strong> on <em>{rTitle}</em> ({st.rating || 'rated'}):{' '}
                      {st.ratingComment}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Teacher-Submitted FAQ Questions */}
          <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#A8567F]" />
                Teacher-Submitted FAQ Questions ({faqs.length})
              </h2>
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                All student questions submitted by teachers (answer or edit them anytime in Teacher Voice & FAQ).
              </p>
            </div>
            {faqs.length === 0 ? (
              <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">No FAQ questions submitted yet.</p>
            ) : (
              <div className="space-y-2.5">
                {faqs.map((f) => (
                  <div
                    key={f.id}
                    className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        {f.level} · {f.category} · Asked by {f.askedByName}
                      </span>
                      <span
                        className={`font-semibold ${
                          f.status === 'answered'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {f.status === 'answered' ? 'Answered' : 'Needs answer'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9]">
                      {f.question}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 5. All Weekly Syllabus Tracker Updates */}
          <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              All Weekly Syllabus Updates ({syllabusEntries.length})
            </h2>
            {syllabusEntries.length === 0 ? (
              <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">No weekly syllabus updates submitted yet.</p>
            ) : (
              <div className="space-y-2.5">
                {syllabusEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                        {entry.levelName} · {entry.className} · {entry.weekLabel}
                      </p>
                      <p className="text-[#5A4A66] dark:text-[#BBAAC9]">
                        By <strong>{entry.teacherName}</strong> · Planned: {entry.plannedUnit}
                        {entry.completedUnit ? ` · Completed: ${entry.completedUnit}` : ''}
                      </p>
                      {entry.materialsGap && (
                        <p className="text-[#8B2C5C] dark:text-[#F0A8CB] font-semibold">
                          Materials gap: {entry.materialsGap}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold text-[#3B1050] dark:text-[#E2B8D0] capitalize shrink-0">
                      {entry.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 6. Recent Team Hellos & Icebreaker Answers */}
          <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#A8567F]" />
              Team Hellos & Icebreaker Posts ({helloFeed.length})
            </h2>
            {helloFeed.length === 0 ? (
              <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">No team posts yet.</p>
            ) : (
              <div className="space-y-2">
                {helloFeed.slice(0, 20).map((post) => (
                  <div
                    key={post.id}
                    className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-xs space-y-0.5"
                  >
                    <p className="font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                      {post.authorName}{' '}
                      <span className="font-normal text-[#A8567F] dark:text-[#D98EB3]">
                        {post.type === 'hello' && post.targetName
                          ? `said hello to ${post.targetName}`
                          : 'answered the weekly icebreaker'}
                      </span>
                    </p>
                    <p className="text-sm text-[#1F122B] dark:text-[#F5EEF9]">{post.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Allowlist & Roles */}
      {subTab === 'allowlist' && (
        <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#A8567F]" />
              Edit Access & Special Roles
            </h2>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] mt-1">
              Any Gmail account can automatically sign in as a Teacher (complete their profile,
              submit surveys, RSVP, book 1-to-1s, and send feedback). Only your owner account (
              {BOOTSTRAPPED_ADMIN_EMAIL}) can edit hub content by default. Add an email below to
              grant Editor / Admin access or restrict someone to View Only.
            </p>
          </div>

          {isPrimaryOwner ? (
            <form onSubmit={handleAddAllowlist} className="grid sm:grid-cols-12 gap-2.5">
              <input
                type="email"
                required
                maxLength={200}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="person.email@gmail.com"
                className="sm:col-span-4 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              <input
                type="text"
                maxLength={120}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (optional)"
                className="sm:col-span-3 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="sm:col-span-3 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              >
                <option value="teacher">Teacher (forms & profile)</option>
                <option value="viewer">View Only (cannot touch anything)</option>
                <option value="admin">Editor / Admin (full edit)</option>
              </select>
              <button
                type="submit"
                disabled={savingAllow}
                className="sm:col-span-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold"
              >
                {savingAllow ? 'Adding...' : 'Add Email'}
              </button>
            </form>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Only Tr Hein ({BOOTSTRAPPED_ADMIN_EMAIL}) can add or remove emails and grant edit
              access.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5D9EC] dark:border-[#332442] text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                <tr>
                  <th className="py-2.5 pr-4">Name</th>
                  <th className="py-2.5 pr-4">Email</th>
                  <th className="py-2.5 pr-4">Access Level</th>
                  {isPrimaryOwner && <th className="py-2.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E6F5] dark:divide-[#2E203D]">
                {allowlist.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isPrimaryOwner ? 4 : 3}
                      className="py-6 text-center text-xs text-[#5A4A66] dark:text-[#BBAAC9]"
                    >
                      No special roles added yet. Any Gmail account can join as a Teacher and
                      submit forms/surveys; only your owner account can currently edit hub content.
                    </td>
                  </tr>
                ) : (
                  allowlist.map((entry) => {
                    const isOwnerRow = entry.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
                    const roleLabel = isOwnerRow
                      ? 'Owner · Full Edit'
                      : entry.role === 'admin'
                        ? 'Editor / Admin (Can Edit)'
                        : entry.role === 'teacher'
                          ? 'Teacher (Forms & Profile)'
                          : 'View Only (Cannot Edit)';
                    return (
                      <tr key={entry.id}>
                        <td className="py-3 pr-4 font-medium">{entry.displayName}</td>
                        <td className="py-3 pr-4 font-mono text-xs">{entry.email}</td>
                        <td className="py-3 pr-4">
                          <span className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
                            {roleLabel}
                          </span>
                        </td>
                        {isPrimaryOwner && (
                          <td className="py-3 text-right whitespace-nowrap">
                            {isOwnerRow ? (
                              <span className="text-xs text-[#7A6888] dark:text-[#9D8AAD]">
                                Protected Owner
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-3">
                                <select
                                  aria-label={`Access level for ${entry.email}`}
                                  value={entry.role}
                                  onChange={(e) =>
                                    handleChangeRole(entry.id, e.target.value as UserRole)
                                  }
                                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs font-medium"
                                >
                                  <option value="viewer">View Only</option>
                                  <option value="teacher">Teacher</option>
                                  <option value="admin">Editor / Admin</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAllowlist(entry.id)}
                                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: One-to-One Slots */}
      {subTab === 'slots' && (
        <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-[#A8567F]" />
            Manage 1-to-1 Meeting Slots
          </h2>

          <form onSubmit={handleAddSlot} className="grid sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              required
              maxLength={120}
              value={slotLabel}
              onChange={(e) => setSlotLabel(e.target.value)}
              placeholder="Slot label"
              className="sm:col-span-5 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
            <input
              type="datetime-local"
              required
              value={slotDateTime}
              onChange={(e) => setSlotDateTime(e.target.value)}
              className="sm:col-span-3 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
            />
            <input
              type="number"
              min={10}
              max={60}
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="sm:col-span-2 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm tabular-nums"
            />
            <button
              type="submit"
              disabled={savingSlot}
              className="sm:col-span-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#3B1050] text-white text-sm font-semibold inline-flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add slot
            </button>
          </form>

          <div className="space-y-2.5">
            {oneToOneSlots.map((slot) => (
              <div
                key={slot.id}
                className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-bold">{slot.label}</p>
                  <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] tabular-nums">
                    {formatLocalDateTime(slot.dateTimeIso)} · {slot.durationMins} mins ·{' '}
                    {slot.bookedByName ? (
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        Booked by {slot.bookedByName}
                      </strong>
                    ) : (
                      'Open'
                    )}
                  </p>
                  {slot.notes && (
                    <p className="text-xs text-[#5A4A66] dark:text-[#C5B4D4] mt-0.5">
                      Teacher note: {slot.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteDoc(doc(db, 'oneToOneSlots', slot.id))}
                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline self-start sm:self-center"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 4: Private Observations & Developmental Feedback */}
      {subTab === 'observations' && (
        <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#A8567F]" />
              Schedule Observation & Write Private Feedback
            </h2>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Every observation record is strictly private to that teacher, Tr Hein, and the Founder.
            </p>
          </div>

          <form onSubmit={handleCreateObservation} className="grid sm:grid-cols-12 gap-2.5">
            <input
              type="email"
              required
              value={obsEmail}
              onChange={(e) => setObsEmail(e.target.value)}
              placeholder="Teacher email (from allowlist)"
              className="sm:col-span-3 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
            />
            <input
              type="text"
              required
              value={obsName}
              onChange={(e) => setObsName(e.target.value)}
              placeholder="Teacher name"
              className="sm:col-span-3 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
            <input
              type="text"
              required
              value={obsClass}
              onChange={(e) => setObsClass(e.target.value)}
              placeholder="Level & class (e.g., B1 Evening)"
              className="sm:col-span-2 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
            <input
              type="datetime-local"
              required
              value={obsDate}
              onChange={(e) => setObsDate(e.target.value)}
              className="sm:col-span-2 min-h-[44px] px-2.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
            />
            <button
              type="submit"
              disabled={savingObs}
              className="sm:col-span-2 min-h-[44px] px-3 py-2 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
            >
              Schedule
            </button>
          </form>

          {editingObs && (
            <form
              onSubmit={handleSaveObsFeedback}
              className="p-5 rounded-2xl bg-[#F4EEF7] dark:bg-[#2A1D38] border border-[#E5D9EC] dark:border-[#3E2D52] space-y-3"
            >
              <h3 className="text-sm font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                Private Developmental Feedback for {editingObs.teacherName} ({editingObs.levelClass})
              </h3>
              <textarea
                rows={2}
                maxLength={1500}
                value={fbWorked}
                onChange={(e) => setFbWorked(e.target.value)}
                placeholder="What worked well in the lesson..."
                className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  maxLength={200}
                  value={fbAction1}
                  onChange={(e) => setFbAction1(e.target.value)}
                  placeholder="Agreed change #1 (specific & clear)"
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
                <input
                  type="text"
                  maxLength={200}
                  value={fbAction2}
                  onChange={(e) => setFbAction2(e.target.value)}
                  placeholder="Agreed change #2 (optional — max 2)"
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  maxLength={800}
                  value={fbSupport}
                  onChange={(e) => setFbSupport(e.target.value)}
                  placeholder="Support Tr Hein will provide"
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
                <input
                  type="date"
                  value={fbReviewDate}
                  onChange={(e) => setFbReviewDate(e.target.value)}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
                <select
                  value={fbStatus}
                  onChange={(e) => setFbStatus(e.target.value as ObservationDoc['status'])}
                  className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="observed">Observed</option>
                  <option value="feedback_shared">Feedback shared</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingObs(null)}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl border border-[#E5D9EC] bg-white dark:bg-[#1F1629] text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingObs}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
                >
                  Save private feedback
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {observations.map((obs) => (
              <div
                key={obs.id}
                className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">
                      {obs.teacherName} · {obs.levelClass}
                    </p>
                    <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] tabular-nums">
                      {formatLocalDateTime(obs.plannedDateIso)} · Status: {obs.status.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditObsFeedback(obs)}
                      className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
                    >
                      Edit feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDoc(doc(db, 'observations', obs.id))}
                      className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {obs.teacherReply && (
                  <p className="text-xs text-[#3A2847] dark:text-[#DFD0EC] bg-white dark:bg-[#1F1629] p-2.5 rounded-lg">
                    <strong>Teacher reply:</strong> {obs.teacherReply}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 5: Needs Survey Results & Anonymous Suggestions */}
      {subTab === 'surveys' && (
        <div className="grid lg:grid-cols-12 gap-5">
          <section className="lg:col-span-7 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Top Requested Support Topics ({allSurveys.length} responses)
            </h2>
            {surveyTopicTally.length === 0 ? (
              <p className="text-sm text-[#5A4A66]">No Needs Surveys submitted yet.</p>
            ) : (
              <div className="space-y-2.5">
                {surveyTopicTally.map(([topic, count]) => (
                  <div key={topic} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{topic}</span>
                      <span className="tabular-nums font-bold">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F4EEF7] dark:bg-[#2A1D38] overflow-hidden">
                      <div
                        className="h-full bg-[#A8567F]"
                        style={{
                          width: `${Math.min(100, (count / Math.max(1, allSurveys.length)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-[#E5D9EC] dark:border-[#332442] space-y-3">
              <h3 className="text-sm font-bold">Individual Survey Responses ({allSurveys.length})</h3>
              {allSurveys.map((s) => (
                <div
                  key={s.uid}
                  className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-xs space-y-1.5"
                >
                  <p className="font-bold text-[#3B1050] dark:text-[#E2B8D0]">{s.teacherName}</p>
                  {s.helpTopics && s.helpTopics.length > 0 && (
                    <p>
                      <strong>Requested topics:</strong> {s.helpTopics.join(', ')}
                    </p>
                  )}
                  {s.feedbackStyle && <p><strong>Feedback style:</strong> {s.feedbackStyle}</p>}
                  {s.bestTimes && <p><strong>Best times:</strong> {s.bestTimes}</p>}
                  {s.ideas && <p><strong>Ideas:</strong> {s.ideas}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Anonymous Suggestion Box ({suggestions.length})
            </h2>
            {suggestions.length === 0 ? (
              <p className="text-sm text-[#5A4A66]">No anonymous suggestions yet.</p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        {sug.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteDoc(doc(db, 'suggestions', sug.id))}
                        className="text-red-600 dark:text-red-400 hover:underline"
                      >
                        Archive
                      </button>
                    </div>
                    <p className="text-sm text-[#1F122B] dark:text-[#F5EEF9]">{sug.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 6: Printable One-Page Month 1 Report */}
      {subTab === 'report' && (
        <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5D9EC] dark:border-[#332442] pb-4">
            <div>
              <p className="text-xs font-semibold text-[#A8567F]">One-Page Founder Summary</p>
              <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                YAO English — Month 1 Academic Progress Report
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadMonth1ReportPdf({
                  obsCompleted: obsCompletedCount,
                  obsTotal: observations.length,
                  bookedSlots: bookedSlotsCount,
                  workshopsCount: trainingSessions.filter((s) => s.month === 1).length,
                  answeredFaqs: answeredFaqCount,
                  agreedActions: observations.flatMap((o) => o.actions || []).slice(0, 6),
                  flaggedGaps: flaggedGaps.map((g) => ({
                    levelName: g.levelName,
                    className: g.className,
                    note: g.materialsGap || `Needs materials for ${g.plannedUnit}`,
                  })),
                  supportNote: reportSupportNote,
                  nextSteps: reportNextSteps,
                })
              }
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold no-print"
            >
              <Download className="w-4 h-4" />
              Download PDF Report
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442]">
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">Classes Observed</p>
              <p className="text-xl font-bold text-[#3B1050] dark:text-[#E8D5F5] tabular-nums">
                {obsCompletedCount} / {observations.length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442]">
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">1-to-1s Booked</p>
              <p className="text-xl font-bold text-[#3B1050] dark:text-[#E8D5F5] tabular-nums">
                {bookedSlotsCount}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442]">
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">Workshops Planned</p>
              <p className="text-xl font-bold text-[#3B1050] dark:text-[#E8D5F5] tabular-nums">
                {trainingSessions.filter((s) => s.month === 1).length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442]">
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">Shared FAQs Ready</p>
              <p className="text-xl font-bold text-[#3B1050] dark:text-[#E8D5F5] tabular-nums">
                {answeredFaqCount}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-bold text-[#3B1050] dark:text-[#E2B8D0] mb-1">
                Changes Agreed From Observations
              </h3>
              {observations.flatMap((o) => o.actions || []).length === 0 ? (
                <p className="text-[#5A4A66]">Baseline observations are currently in progress.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-[#3A2847] dark:text-[#DFD0EC]">
                  {observations
                    .flatMap((o) => o.actions || [])
                    .slice(0, 6)
                    .map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-bold text-[#3B1050] dark:text-[#E2B8D0] mb-1">
                Materials Gaps Flagged by Teachers ({flaggedGaps.length})
              </h3>
              {flaggedGaps.length === 0 ? (
                <p className="text-[#5A4A66] dark:text-[#BBAAC9]">
                  No unresolved materials gaps reported in the Weekly Syllabus Tracker.
                </p>
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-[#3A2847] dark:text-[#DFD0EC]">
                  {flaggedGaps.map((g) => (
                    <li key={g.id}>
                      <strong>
                        {g.levelName} ({g.className}):
                      </strong>{' '}
                      {g.materialsGap || `Needs materials for ${g.plannedUnit}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-bold text-[#3B1050] dark:text-[#E2B8D0] mb-1">
                Students Needing Support (Group-Level Summary — No Personal Data)
              </h3>
              <textarea
                rows={2}
                value={reportSupportNote}
                onChange={(e) => setReportSupportNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>

            <div>
              <h3 className="font-bold text-[#3B1050] dark:text-[#E2B8D0] mb-1">
                Actions & Month 2 Next Steps
              </h3>
              <textarea
                rows={3}
                value={reportNextSteps}
                onChange={(e) => setReportNextSteps(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
