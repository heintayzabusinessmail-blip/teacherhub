import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Edit3,
  Flag,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  PAGE_SUMMARIES,
  ROADMAP_FUTURE_MONTHS,
  ROADMAP_MONTH_1_WEEKS,
} from '../content/planContent';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PageHeader } from '../components/PageHeader';
import { downloadRoadmapPdf } from '../utils/pdfExport';
import type { CurriculumComment, CurriculumMapDoc, SyllabusEntry, SyllabusStatus } from '../types';

const STATUS_META: Record<
  SyllabusStatus,
  { label: string; textClass: string; bgClass: string }
> = {
  on_track: {
    label: 'On track',
    textClass: 'text-[#3B1050] dark:text-[#E8D5F5]',
    bgClass: 'bg-[#F4EEF7] dark:bg-[#2A1D38]',
  },
  completed: {
    label: 'Unit completed',
    textClass: 'text-emerald-800 dark:text-emerald-300',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
  },
  slightly_behind: {
    label: 'Slightly behind',
    textClass: 'text-amber-800 dark:text-amber-300',
    bgClass: 'bg-amber-50 dark:bg-amber-950/40',
  },
  needs_materials: {
    label: 'Materials gap flagged',
    textClass: 'text-[#8B2C5C] dark:text-[#F0A8CB]',
    bgClass: 'bg-[#FCEEF5] dark:bg-[#3A1B2E]',
  },
};

export function RoadmapPage() {
  const { user, myProfile, isAdmin, canInteract, curriculumMaps, syllabusEntries } = useHub();
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [activeLevelId, setActiveLevelId] = useState<string>('');
  const [comments, setComments] = useState<CurriculumComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Admin curriculum editor
  const [editingMap, setEditingMap] = useState<CurriculumMapDoc | null>(null);
  const [creatingMap, setCreatingMap] = useState(false);
  const [formLevel, setFormLevel] = useState('');
  const [formCoursebook, setFormCoursebook] = useState('');
  const [formUnits, setFormUnits] = useState('');
  const [formOutcomes, setFormOutcomes] = useState('');
  const [formPacing, setFormPacing] = useState('');
  const [formAssessments, setFormAssessments] = useState('');
  const [formGaps, setFormGaps] = useState('');
  const [savingMap, setSavingMap] = useState(false);

  // Live Weekly Syllabus Tracker state
  const [trackerLevelFilter, setTrackerLevelFilter] = useState<string>('all');
  const [gapsOnly, setGapsOnly] = useState(false);
  const [showTrackerForm, setShowTrackerForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SyllabusEntry | null>(null);
  const [trClassName, setTrClassName] = useState('');
  const [trLevelName, setTrLevelName] = useState('B1');
  const [trWeekLabel, setTrWeekLabel] = useState('Month 1 · Week 3');
  const [trPlannedUnit, setTrPlannedUnit] = useState('');
  const [trCompletedUnit, setTrCompletedUnit] = useState('');
  const [trStatus, setTrStatus] = useState<SyllabusStatus>('on_track');
  const [trMaterialsGap, setTrMaterialsGap] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  const availableLevelNames = useMemo(() => {
    const set = new Set<string>(['A2', 'B1', 'B2', 'IELTS', 'One-to-One']);
    curriculumMaps.forEach((m) => {
      if (m.levelName.trim()) set.add(m.levelName.trim());
    });
    syllabusEntries.forEach((s) => {
      if (s.levelName.trim()) set.add(s.levelName.trim());
    });
    return Array.from(set);
  }, [curriculumMaps, syllabusEntries]);

  const flaggedGapCount = useMemo(
    () =>
      syllabusEntries.filter(
        (s) => s.status === 'needs_materials' || s.materialsGap.trim().length > 0
      ).length,
    [syllabusEntries]
  );

  const filteredSyllabusEntries = useMemo(() => {
    return syllabusEntries.filter((entry) => {
      if (trackerLevelFilter !== 'all' && entry.levelName !== trackerLevelFilter) return false;
      if (gapsOnly && entry.status !== 'needs_materials' && !entry.materialsGap.trim()) return false;
      return true;
    });
  }, [syllabusEntries, trackerLevelFilter, gapsOnly]);

  useEffect(() => {
    if (curriculumMaps.length > 0 && !activeLevelId) {
      setActiveLevelId(curriculumMaps[0].id);
    }
  }, [curriculumMaps, activeLevelId]);

  const activeMap = curriculumMaps.find((m) => m.id === activeLevelId) || curriculumMaps[0] || null;

  // Subscribe to comments for active curriculum map
  useEffect(() => {
    if (!activeMap) {
      setComments([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'curriculumMaps', activeMap.id, 'comments'),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as CurriculumComment), id: d.id }));
        list.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
        setComments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `curriculumMaps/${activeMap.id}/comments`)
    );
    return () => unsub();
  }, [activeMap]);

  const openCreateMap = () => {
    setEditingMap(null);
    setCreatingMap(true);
    setFormLevel('');
    setFormCoursebook('');
    setFormUnits('');
    setFormOutcomes('');
    setFormPacing('');
    setFormAssessments('');
    setFormGaps('');
  };

  const openEditMap = (m: CurriculumMapDoc) => {
    setCreatingMap(false);
    setEditingMap(m);
    setFormLevel(m.levelName);
    setFormCoursebook(m.coursebook);
    setFormUnits(m.units);
    setFormOutcomes(m.learningOutcomes);
    setFormPacing(m.weeklyPacing);
    setFormAssessments(m.assessments);
    setFormGaps(m.gaps);
  };

  const handleSaveMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLevel.trim()) return;
    setSavingMap(true);
    try {
      const id =
        editingMap?.id ||
        `level_${formLevel
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`;
      await setDoc(doc(db, 'curriculumMaps', id), {
        levelName: formLevel.trim().slice(0, 60),
        coursebook: formCoursebook.trim().slice(0, 200),
        units: formUnits.trim().slice(0, 1000),
        learningOutcomes: formOutcomes.trim().slice(0, 1500),
        weeklyPacing: formPacing.trim().slice(0, 1000),
        assessments: formAssessments.trim().slice(0, 1000),
        gaps: formGaps.trim().slice(0, 1000),
        order: editingMap?.order ?? curriculumMaps.length + 1,
        isSample: false,
        updatedAt: serverTimestamp(),
      });
      setActiveLevelId(id);
      setEditingMap(null);
      setCreatingMap(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'curriculumMaps');
    } finally {
      setSavingMap(false);
    }
  };

  const handleDeleteMap = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'curriculumMaps', id));
      if (activeLevelId === id) setActiveLevelId('');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `curriculumMaps/${id}`);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMap || !user || !canInteract || !commentInput.trim()) return;
    setPostingComment(true);
    try {
      await addDoc(collection(db, 'curriculumMaps', activeMap.id, 'comments'), {
        authorUid: user.uid,
        authorName: (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120),
        text: commentInput.trim().slice(0, 500),
        isSample: false,
        createdAt: serverTimestamp(),
      });
      setCommentInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `curriculumMaps/${activeMap.id}/comments`);
    } finally {
      setPostingComment(false);
    }
  };

  const openCreateTrackerEntry = () => {
    setEditingEntry(null);
    setTrClassName('');
    setTrLevelName(activeMap?.levelName || availableLevelNames[0] || 'B1');
    setTrWeekLabel('Month 1 · Week 3');
    setTrPlannedUnit('');
    setTrCompletedUnit('');
    setTrStatus('on_track');
    setTrMaterialsGap('');
    setShowTrackerForm(true);
  };

  const openEditTrackerEntry = (entry: SyllabusEntry) => {
    setEditingEntry(entry);
    setTrClassName(entry.className);
    setTrLevelName(entry.levelName);
    setTrWeekLabel(entry.weekLabel);
    setTrPlannedUnit(entry.plannedUnit);
    setTrCompletedUnit(entry.completedUnit);
    setTrStatus(entry.status);
    setTrMaterialsGap(entry.materialsGap);
    setShowTrackerForm(true);
  };

  const handleSaveTrackerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canInteract || !trClassName.trim() || !trPlannedUnit.trim() || !trWeekLabel.trim()) return;
    setSavingEntry(true);
    const actorName = (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120);
    try {
      const now = serverTimestamp();
      if (editingEntry) {
        await updateDoc(doc(db, 'syllabusEntries', editingEntry.id), {
          levelName: trLevelName.trim().slice(0, 60) || 'B1',
          className: trClassName.trim().slice(0, 120),
          weekLabel: trWeekLabel.trim().slice(0, 60),
          plannedUnit: trPlannedUnit.trim().slice(0, 200),
          completedUnit: trCompletedUnit.trim().slice(0, 200),
          status: trStatus,
          materialsGap: trMaterialsGap.trim().slice(0, 500),
          updatedByName: actorName,
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, 'syllabusEntries'), {
          teacherUid: user.uid,
          teacherName: actorName,
          updatedByName: actorName,
          levelName: trLevelName.trim().slice(0, 60) || 'B1',
          className: trClassName.trim().slice(0, 120),
          weekLabel: trWeekLabel.trim().slice(0, 60),
          plannedUnit: trPlannedUnit.trim().slice(0, 200),
          completedUnit: trCompletedUnit.trim().slice(0, 200),
          status: trStatus,
          materialsGap: trMaterialsGap.trim().slice(0, 500),
          isSample: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      setShowTrackerForm(false);
      setEditingEntry(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'syllabusEntries');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleToggleUnitCompleted = async (entry: SyllabusEntry) => {
    if (!user || !canInteract) return;
    setBusyEntryId(entry.id);
    const actorName = (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120);
    const nextCompleted = entry.status !== 'completed';
    try {
      await updateDoc(doc(db, 'syllabusEntries', entry.id), {
        status: nextCompleted ? 'completed' : 'on_track',
        completedUnit: nextCompleted
          ? (entry.completedUnit.trim() || entry.plannedUnit).slice(0, 200)
          : entry.completedUnit.slice(0, 200),
        updatedByName: actorName,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `syllabusEntries/${entry.id}`);
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleResolveMaterialsGap = async (entry: SyllabusEntry) => {
    if (!user || !isAdmin) return;
    setBusyEntryId(entry.id);
    const actorName = (myProfile?.displayName || user.displayName || 'Tr Hein').slice(0, 120);
    try {
      await updateDoc(doc(db, 'syllabusEntries', entry.id), {
        materialsGap: '',
        status: entry.status === 'needs_materials' ? 'on_track' : entry.status,
        updatedByName: actorName,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `syllabusEntries/${entry.id}`);
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleDeleteTrackerEntry = async (entryId: string) => {
    setBusyEntryId(entryId);
    try {
      await deleteDoc(doc(db, 'syllabusEntries', entryId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `syllabusEntries/${entryId}`);
    } finally {
      setBusyEntryId(null);
    }
  };

  const timelineMonths = [
    { month: 1, short: 'Month 1', label: 'Foundation & Map', review: 'Review 1' },
    { month: 2, short: 'Month 2', label: 'Better Lessons', review: '' },
    { month: 3, short: 'Month 3', label: 'Materials & Pace', review: 'Review 2' },
    { month: 4, short: 'Month 4', label: 'Learner Support', review: '' },
    { month: 5, short: 'Month 5', label: 'Practise & Grow', review: '' },
    { month: 6, short: 'Month 6', label: 'Results & Next Plan', review: 'Review 3' },
  ];

  const selectedFuture = ROADMAP_FUTURE_MONTHS.find((m) => m.month === selectedMonth);

  return (
    <div className="space-y-8">
      <PageHeader
        title="6-Month Roadmap & Month 1 Curriculum Map"
        inShort={PAGE_SUMMARIES.roadmap}
        action={
          <button
            type="button"
            onClick={() => downloadRoadmapPdf(curriculumMaps, syllabusEntries)}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        }
      />

      {/* Interactive Timeline Strip (Horizontal on desktop, Vertical stack on mobile) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
            Road from Month 1 to Month 6
          </h2>
          <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            Review points marked at Months 1, 3, and 6
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 no-print">
          {timelineMonths.map((item) => {
            const active = selectedMonth === item.month;
            return (
              <button
                key={item.month}
                type="button"
                onClick={() => setSelectedMonth(item.month)}
                className={`min-h-[76px] p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  active
                    ? 'bg-[#3B1050] border-[#3B1050] text-white shadow-sm'
                    : 'bg-white dark:bg-[#1F1629] border-[#E5D9EC] dark:border-[#332442] text-[#1F122B] dark:text-[#F5EEF9] hover:border-[#A8567F]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      active ? 'text-[#E8B7D0]' : 'text-[#A8567F] dark:text-[#D98EB3]'
                    }`}
                  >
                    {item.short}
                  </span>
                  {item.review && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                        active ? 'text-white' : 'text-[#3B1050] dark:text-[#E2B8D0]'
                      }`}
                    >
                      <Flag className="w-3 h-3" />
                      {item.review}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold leading-snug mt-1">{item.label}</p>
              </button>
            );
          })}
        </div>

        {/* Active Month Detail Panel */}
        {selectedMonth === 1 ? (
          <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5D9EC] dark:border-[#332442] pb-4">
              <div>
                <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                  Month 1 · Open in full detail · Review Point 1 at Week 4
                </p>
                <h3 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9] mt-0.5">
                  Get to know the team, set up tools, map the curriculum
                </h3>
              </div>
              <span className="text-xs font-medium text-[#5A4A66] dark:text-[#BBAAC9]">
                Training in Month 1: twice a month, led by Tr Hein
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {ROADMAP_MONTH_1_WEEKS.map((w) => (
                <div
                  key={w.week}
                  className="rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-5 space-y-3 print-break-avoid"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#A8567F] dark:text-[#D98EB3]">
                      {w.week}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                    {w.title}
                  </h4>
                  <p className="text-sm text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                    {w.summary}
                  </p>
                  <ul className="space-y-1.5 pt-2 border-t border-[#E5D9EC] dark:border-[#332442]">
                    {w.deliverables.map((d) => (
                      <li
                        key={d}
                        className="text-xs sm:text-sm text-[#3A2847] dark:text-[#DFD0EC] flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#A8567F] shrink-0 mt-0.5" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] bg-[#F4EEF7] dark:bg-[#2A1D38] rounded-xl px-4 py-3">
              <strong>Training rhythm:</strong> In Month 1, Tr Hein leads both training workshops.
              From later months, teachers who want to share a great technique are warmly invited to
              co-lead or lead sessions too.
            </p>
          </div>
        ) : (
          selectedFuture && (
            <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                  {selectedFuture.tag}
                </span>
                {selectedFuture.isReview && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                    <Flag className="w-3.5 h-3.5" />
                    {selectedFuture.reviewLabel}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                {selectedFuture.title}
              </h3>
              <ul className="space-y-2.5 text-sm sm:text-base text-[#3A2847] dark:text-[#DFD0EC]">
                {selectedFuture.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#A8567F] shrink-0 mt-1" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        {/* Compact overview of Months 2–6 always visible below (and in print!) */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ROADMAP_FUTURE_MONTHS.map((m) => (
            <button
              key={m.month}
              type="button"
              onClick={() => setSelectedMonth(m.month)}
              className={`rounded-2xl border p-4 text-left space-y-2 transition-colors print-break-avoid ${
                selectedMonth === m.month
                  ? 'bg-[#F4EEF7] dark:bg-[#2A1D38] border-[#3B1050] dark:border-[#D98EB3]'
                  : 'bg-white dark:bg-[#1F1629] border-[#E5D9EC] dark:border-[#332442] hover:border-[#A8567F]'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="font-bold text-[#A8567F] dark:text-[#D98EB3]">Month {m.month}</span>
                {m.isReview && <Flag className="w-3.5 h-3.5 text-[#3B1050] dark:text-[#E2B8D0]" />}
              </div>
              <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] leading-snug">
                {m.title.replace(/^Month \d+:\s*/, '')}
              </p>
              <p className="text-[11px] text-[#7A6888] dark:text-[#9D8AAD]">{m.tag}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Curriculum Work in Month 1 (Editable per level + Teacher Comments) */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Month 1 Curriculum Map by Level
            </h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Record coursebooks, units, learning outcomes, weekly pacing, assessments, and gaps.
              Teachers can leave comments on any level.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={openCreateMap}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold whitespace-nowrap no-print"
            >
              <Plus className="w-4 h-4" />
              Add level
            </button>
          )}
        </div>

        {/* Admin Create / Edit Map Form */}
        {isAdmin && (creatingMap || editingMap) && (
          <form
            onSubmit={handleSaveMap}
            className="p-5 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-4 no-print"
          >
            <h3 className="text-base font-bold text-[#3B1050] dark:text-[#E8D5F5]">
              {editingMap ? `Edit ${editingMap.levelName} Curriculum Map` : 'Add New Level'}
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Level name *</label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value)}
                  placeholder="e.g., A2, B1, B2, One-to-One"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Coursebook / main syllabus</label>
                <input
                  type="text"
                  maxLength={200}
                  value={formCoursebook}
                  onChange={(e) => setFormCoursebook(e.target.value)}
                  placeholder="e.g., Cambridge Empower B1"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Units covered</label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={formUnits}
                  onChange={(e) => setFormUnits(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Weekly pacing</label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={formPacing}
                  onChange={(e) => setFormPacing(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Learning outcomes per unit</label>
              <textarea
                rows={2}
                maxLength={1500}
                value={formOutcomes}
                onChange={(e) => setFormOutcomes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Assessments</label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={formAssessments}
                  onChange={(e) => setFormAssessments(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Materials or syllabus gaps</label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={formGaps}
                  onChange={(e) => setFormGaps(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingMap}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
              >
                {savingMap ? 'Saving...' : 'Save level map'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingMap(null);
                  setCreatingMap(false);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {curriculumMaps.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#D3C0DF] dark:border-[#3E2D52] rounded-2xl">
            <p className="text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9]">
              No curriculum maps added yet.
            </p>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              {isAdmin
                ? 'Click “Add level” above or load sample data on Home to start mapping A2, B1, B2, and One-to-One.'
                : 'Tr Hein will publish each level’s curriculum map here during Month 1.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Level filter tabs */}
            <div className="flex flex-wrap gap-2 no-print">
              {curriculumMaps.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveLevelId(m.id)}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeMap?.id === m.id
                      ? 'bg-[#3B1050] text-white'
                      : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#E8DCF0]'
                  }`}
                >
                  {m.levelName}
                </button>
              ))}
            </div>

            {activeMap && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] p-5 sm:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        Level Map
                      </p>
                      <h3 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                        {activeMap.levelName} — {activeMap.coursebook || 'Coursebook TBC'}
                      </h3>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2 no-print">
                        <button
                          type="button"
                          onClick={() => openEditMap(activeMap)}
                          className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMap(activeMap.id)}
                          className="min-h-[38px] inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-red-600 dark:text-red-400"
                          aria-label="Delete level map"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0]">Units</p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                        {activeMap.units || 'Not filled yet.'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                        Weekly Pacing
                      </p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                        {activeMap.weeklyPacing || 'Not filled yet.'}
                      </p>
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <p className="text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                        Learning Outcomes per Unit
                      </p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                        {activeMap.learningOutcomes || 'Not filled yet.'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                        Assessments
                      </p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                        {activeMap.assessments || 'Not filled yet.'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#A8567F] dark:text-[#D98EB3]">
                        Known Gaps & Fixes Needed
                      </p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                        {activeMap.gaps || 'None noted yet.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Teacher Comments on Active Level */}
                <div className="space-y-3 no-print">
                  <h4 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#A8567F]" />
                    Teacher Comments on {activeMap.levelName} ({comments.length})
                  </h4>

                  {comments.length > 0 && (
                    <ul className="space-y-2">
                      {comments.map((c) => (
                        <li
                          key={c.id}
                          className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-sm"
                        >
                          <p className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
                            {c.authorName}
                          </p>
                          <p className="text-[#3A2847] dark:text-[#DFD0EC] mt-0.5">{c.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  {canInteract && (
                    <form onSubmit={handlePostComment} className="flex gap-2">
                      <input
                        type="text"
                        maxLength={500}
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder={`Suggest a fix, pacing note, or missing slide for ${activeMap.levelName}...`}
                        className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                      />
                      <button
                        type="submit"
                        disabled={postingComment || !commentInput.trim()}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        Post
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Live Weekly Syllabus Tracker */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#A8567F]" />
              Weekly Syllabus Tracker (Live)
            </h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Log each class’s weekly unit, tick off finished units in one click, and flag missing
              slides or audio directly to Tr Hein. (No student names — class progress only.)
            </p>
          </div>
          {canInteract && (
            <button
              type="button"
              onClick={openCreateTrackerEntry}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold whitespace-nowrap no-print"
            >
              <Plus className="w-4 h-4" />
              Add weekly update
            </button>
          )}
        </div>

        {/* Create / Edit Weekly Update Form */}
        {showTrackerForm && (
          <form
            onSubmit={handleSaveTrackerEntry}
            className="p-5 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-4 no-print"
          >
            <h3 className="text-base font-bold text-[#3B1050] dark:text-[#E8D5F5]">
              {editingEntry ? `Update ${editingEntry.className}` : 'Add Class Weekly Progress'}
            </h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Class / group name *</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={trClassName}
                  onChange={(e) => setTrClassName(e.target.value)}
                  placeholder="e.g., B1 Evening Group (Tue/Thu)"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">CEFR level *</label>
                <select
                  value={trLevelName}
                  onChange={(e) => setTrLevelName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                >
                  {availableLevelNames.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Week label *</label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={trWeekLabel}
                  onChange={(e) => setTrWeekLabel(e.target.value)}
                  placeholder="e.g., Month 1 · Week 3"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Planned unit / lesson *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={trPlannedUnit}
                  onChange={(e) => setTrPlannedUnit(e.target.value)}
                  placeholder="e.g., Empower B1 Unit 2A–2B (Past Simple vs Continuous)"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Completed so far</label>
                <input
                  type="text"
                  maxLength={200}
                  value={trCompletedUnit}
                  onChange={(e) => setTrCompletedUnit(e.target.value)}
                  placeholder="e.g., Unit 2A completed; starting 2B speaking on Thu"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold mb-1">Pacing status</label>
                <select
                  value={trStatus}
                  onChange={(e) => setTrStatus(e.target.value as SyllabusStatus)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                >
                  <option value="on_track">On track</option>
                  <option value="completed">Unit completed</option>
                  <option value="slightly_behind">Slightly behind</option>
                  <option value="needs_materials">Materials gap — need help</option>
                </select>
              </div>
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold mb-1">
                  Materials gap or support note for Tr Hein (optional)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={trMaterialsGap}
                  onChange={(e) => setTrMaterialsGap(e.target.value)}
                  placeholder="e.g., Missing audio track 2.14 or need extra speaking cards for Unit 3A"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingEntry}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
              >
                {savingEntry ? 'Saving...' : editingEntry ? 'Save changes' : 'Post weekly update'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTrackerForm(false);
                  setEditingEntry(null);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTrackerLevelFilter('all')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                trackerLevelFilter === 'all'
                  ? 'bg-[#3B1050] text-white'
                  : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
              }`}
            >
              All levels ({syllabusEntries.length})
            </button>
            {availableLevelNames.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setTrackerLevelFilter(lvl)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  trackerLevelFilter === lvl
                    ? 'bg-[#3B1050] text-white'
                    : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setGapsOnly((prev) => !prev)}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors tabular-nums ${
              gapsOnly
                ? 'bg-[#A8567F] border-[#A8567F] text-white'
                : 'bg-white dark:bg-[#1F1629] border-[#E5D9EC] dark:border-[#332442] text-[#3B1050] dark:text-[#E8D5F5]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Materials gaps only ({flaggedGapCount})
          </button>
        </div>

        {/* Entries List */}
        {filteredSyllabusEntries.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#D3C0DF] dark:border-[#3E2D52] rounded-2xl">
            <p className="text-sm font-semibold text-[#1F122B] dark:text-[#F5EEF9]">
              No weekly syllabus updates match this filter yet.
            </p>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Tap “Add weekly update” above to log your class’s unit progress or flag a missing
              resource.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredSyllabusEntries.map((entry) => {
              const canEdit = isAdmin || entry.teacherUid === user?.uid;
              const meta = STATUS_META[entry.status] || STATUS_META.on_track;
              const hasGap =
                entry.status === 'needs_materials' || entry.materialsGap.trim().length > 0;
              const isBusy = busyEntryId === entry.id;

              return (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] p-5 flex flex-col justify-between gap-4 print-break-avoid"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-[#7A6888] dark:text-[#9D8AAD]">
                          <span className="font-bold text-[#3B1050] dark:text-[#E2B8D0]">
                            {entry.levelName}
                          </span>
                          {' · '}
                          {entry.weekLabel}
                          {' · '}
                          {entry.teacherName}
                        </p>
                        <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] mt-0.5">
                          {entry.className}
                        </h3>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.bgClass} ${meta.textClass}`}
                      >
                        {entry.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : entry.status === 'needs_materials' ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {meta.label}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <p className="text-[#3A2847] dark:text-[#DFD0EC]">
                        <span className="text-xs font-bold text-[#5A4A66] dark:text-[#BBAAC9] block">
                          Planned unit
                        </span>
                        {entry.plannedUnit}
                      </p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC]">
                        <span className="text-xs font-bold text-[#5A4A66] dark:text-[#BBAAC9] block">
                          Completed so far
                        </span>
                        {entry.completedUnit || 'In progress'}
                      </p>
                    </div>

                    {entry.materialsGap.trim() && (
                      <div className="p-3 rounded-xl bg-[#FCEEF5] dark:bg-[#3A1B2E]/70 border border-[#A8567F]/30 text-xs space-y-1">
                        <p className="font-bold text-[#8B2C5C] dark:text-[#F0A8CB] flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Materials gap flagged to Tr Hein
                        </p>
                        <p className="text-[#3A2847] dark:text-[#F5EEF9] leading-relaxed">
                          {entry.materialsGap}
                        </p>
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5D9EC] dark:border-[#332442] no-print">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleUnitCompleted(entry)}
                          className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            entry.status === 'completed'
                              ? 'bg-emerald-700 text-white'
                              : 'bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[#3B1050] dark:text-[#E8D5F5]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {entry.status === 'completed' ? 'Completed' : 'Mark unit done'}
                        </button>

                        {isAdmin && hasGap && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleResolveMaterialsGap(entry)}
                            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-xs font-semibold"
                          >
                            Resolve gap
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openEditTrackerEntry(entry)}
                          className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteTrackerEntry(entry.id)}
                          className="min-h-[38px] inline-flex items-center justify-center px-2.5 py-1.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                          aria-label="Delete syllabus update"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
