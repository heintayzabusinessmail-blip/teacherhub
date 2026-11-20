import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  MessageSquareText,
  Plus,
  Search,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { BOOTSTRAPPED_ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import { getEmbedPreviewUrl, parseResourcesCsv } from '../utils/helpers';
import { notifyAdminOfTeacherAction } from '../utils/notifications';
import type { ResourceItem } from '../types';

const LEVELS = ['All', 'Pre-A1 / A1', 'A2', 'B1', 'B2', 'C1', 'All Levels', 'One-to-One'];
const SKILLS = ['All', 'Speaking', 'Listening', 'Reading', 'Writing', 'Grammar', 'Vocabulary', 'Pronunciation', 'Assessment', 'Lesson Planning', 'Onboarding'];
const TYPES = ['All', 'Coursebook', 'Syllabus', 'Template', 'Slides', 'Audio', 'Activity', 'Assessment', 'Rubric', 'Training Recording', 'Welcome Video'];

type ViewScope = 'all' | 'bookmarks' | 'recent' | 'notes';

export function ResourcesPage() {
  const {
    user,
    isAdmin,
    canInteract,
    myProfile,
    resources,
    myResourceStates,
    queueEmailConfirmation,
  } = useHub();

  const [scope, setScope] = useState<ViewScope>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('All');
  const [skillFilter, setSkillFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  // Preview & Note UI state
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [ratingCommentOpenId, setRatingCommentOpenId] = useState<string | null>(null);
  const [ratingCommentDraft, setRatingCommentDraft] = useState('');

  // Add / Suggest Resource Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRes, setEditingRes] = useState<ResourceItem | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fLevel, setFLevel] = useState('B1');
  const [fSkill, setFSkill] = useState('Speaking');
  const [fType, setFType] = useState('Slides');
  const [fUrl, setFUrl] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [savingRes, setSavingRes] = useState(false);

  // Admin CSV Bulk Import
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvFeedback, setCsvFeedback] = useState('');

  const approvedResources = useMemo(() => resources.filter((r) => r.approved), [resources]);
  const pendingSuggestions = useMemo(() => resources.filter((r) => !r.approved), [resources]);

  const filteredResources = useMemo(() => {
    const tokens = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);

    let list = [...approvedResources];

    if (scope === 'bookmarks') {
      list = list.filter((r) => myResourceStates[r.id]?.bookmarked);
    } else if (scope === 'recent') {
      list = list
        .filter((r) => Boolean(myResourceStates[r.id]?.lastOpenedAt))
        .sort(
          (a, b) =>
            (myResourceStates[b.id]?.lastOpenedAt?.toMillis?.() ?? 0) -
            (myResourceStates[a.id]?.lastOpenedAt?.toMillis?.() ?? 0)
        );
    } else if (scope === 'notes') {
      list = list.filter((r) => Boolean(myResourceStates[r.id]?.personalNote?.trim()));
    }

    if (levelFilter !== 'All') list = list.filter((r) => r.level === levelFilter);
    if (skillFilter !== 'All') list = list.filter((r) => r.skill === skillFilter);
    if (typeFilter !== 'All') list = list.filter((r) => r.type === typeFilter);

    if (tokens.length > 0) {
      list = list.filter((r) => {
        const hay = `${r.title} ${r.level} ${r.skill} ${r.type} ${r.description} ${r.addedBy}`.toLowerCase();
        return tokens.every((tok) => hay.includes(tok));
      });
    }

    return list;
  }, [approvedResources, scope, myResourceStates, levelFilter, skillFilter, typeFilter, searchQuery]);

  const upsertState = async (
    resourceId: string,
    patch: Partial<{
      bookmarked: boolean;
      used: boolean;
      rating: 'up' | 'down' | '';
      ratingComment: string;
      personalNote: string;
      markOpened: boolean;
    }>
  ) => {
    if (!user || !canInteract) return;
    const stateId = `${user.uid}_${resourceId}`;
    const current = myResourceStates[resourceId];
    const now = serverTimestamp();

    const payload: Record<string, unknown> = {
      uid: user.uid,
      resourceId,
      bookmarked: patch.bookmarked ?? current?.bookmarked ?? false,
      used: patch.used ?? current?.used ?? false,
      rating: patch.rating ?? current?.rating ?? '',
      ratingComment: (patch.ratingComment ?? current?.ratingComment ?? '').slice(0, 400),
      personalNote: (patch.personalNote ?? current?.personalNote ?? '').slice(0, 1000),
      updatedAt: now,
    };

    if (patch.markOpened) {
      payload.lastOpenedAt = now;
    } else if (current?.lastOpenedAt) {
      payload.lastOpenedAt = current.lastOpenedAt;
    }

    try {
      await setDoc(doc(db, 'teacherResourceStates', stateId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `teacherResourceStates/${stateId}`);
    }
  };

  const handleOpenResource = async (r: ResourceItem) => {
    if (!canInteract) return;
    await upsertState(r.id, { markOpened: true });
    try {
      await updateDoc(doc(db, 'resources', r.id), {
        openCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${r.id}`);
    }
  };

  const handleToggleUsed = async (r: ResourceItem) => {
    if (!canInteract) return;
    const nextUsed = !myResourceStates[r.id]?.used;
    await upsertState(r.id, { used: nextUsed });
    try {
      await updateDoc(doc(db, 'resources', r.id), {
        usedCount: Math.max(0, (r.usedCount || 0) + (nextUsed ? 1 : -1)),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${r.id}`);
    }
  };

  const handleRate = async (r: ResourceItem, nextRating: 'up' | 'down') => {
    if (!canInteract) return;
    const prevRating = myResourceStates[r.id]?.rating || '';
    const finalRating = prevRating === nextRating ? '' : nextRating;
    await upsertState(r.id, { rating: finalRating });

    let up = r.thumbsUp || 0;
    let down = r.thumbsDown || 0;
    if (prevRating === 'up') up = Math.max(0, up - 1);
    if (prevRating === 'down') down = Math.max(0, down - 1);
    if (finalRating === 'up') up += 1;
    if (finalRating === 'down') down += 1;

    try {
      await updateDoc(doc(db, 'resources', r.id), {
        thumbsUp: up,
        thumbsDown: down,
        updatedAt: serverTimestamp(),
      });
      if (finalRating) {
        setRatingCommentOpenId(r.id);
        setRatingCommentDraft(myResourceStates[r.id]?.ratingComment || '');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${r.id}`);
    }
  };

  const openAddModal = (res?: ResourceItem) => {
    if (res) {
      setEditingRes(res);
      setFTitle(res.title);
      setFLevel(res.level);
      setFSkill(res.skill);
      setFType(res.type);
      setFUrl(res.url);
      setFDesc(res.description);
    } else {
      setEditingRes(null);
      setFTitle('');
      setFLevel('B1');
      setFSkill('Speaking');
      setFType('Slides');
      setFUrl('');
      setFDesc('');
    }
    setShowAddForm(true);
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !fTitle.trim() || !fUrl.trim()) return;
    setSavingRes(true);
    try {
      const now = serverTimestamp();
      if (editingRes && isAdmin) {
        await updateDoc(doc(db, 'resources', editingRes.id), {
          title: fTitle.trim().slice(0, 180),
          level: fLevel.slice(0, 40),
          skill: fSkill.slice(0, 60),
          type: fType.slice(0, 60),
          url: fUrl.trim().slice(0, 600),
          description: fDesc.trim().slice(0, 800),
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, 'resources'), {
          title: fTitle.trim().slice(0, 180),
          level: fLevel.slice(0, 40),
          skill: fSkill.slice(0, 60),
          type: fType.slice(0, 60),
          url: fUrl.trim().slice(0, 600),
          description: fDesc.trim().slice(0, 800),
          addedBy: (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120),
          addedByUid: user.uid,
          approved: isAdmin, // Teacher suggestions wait for admin approval
          openCount: 0,
          usedCount: 0,
          thumbsUp: 0,
          thumbsDown: 0,
          isSample: false,
          createdAt: now,
          updatedAt: now,
        });
        if (!isAdmin) {
          const teacherName = (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120);
          const resTitle = `New resource suggestion from ${teacherName}`;
          const resMsg = `${fTitle.trim().slice(0, 140)} (${fLevel} · ${fSkill} · ${fType}) is waiting for your approval.`;
          await notifyAdminOfTeacherAction({
            actorUid: user.uid,
            actorName: teacherName,
            category: 'resource_suggested',
            title: resTitle,
            message: resMsg,
            targetTab: 'admin',
            priority: 'normal',
          });
          if (user.email?.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL) {
            queueEmailConfirmation({
              heading: 'Email this resource suggestion to Tr Hein',
              recipients: [BOOTSTRAPPED_ADMIN_EMAIL],
              subject: `[YAO Hub] ${resTitle}`,
              bodyText: `${resMsg}\nLink: ${fUrl.trim().slice(0, 400)}\n\nReview and approve in Admin Dashboard → Teacher Submissions.`,
              senderLabel: `Suggested by ${teacherName}`,
            });
          }
        }
      }
      setShowAddForm(false);
      setEditingRes(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'resources');
    } finally {
      setSavingRes(false);
    }
  };

  const handleApproveSuggestion = async (r: ResourceItem) => {
    try {
      await updateDoc(doc(db, 'resources', r.id), {
        approved: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `resources/${r.id}`);
    }
  };

  const handleDeleteResource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'resources', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `resources/${id}`);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    const rows = parseResourcesCsv(csvText);
    if (rows.length === 0) {
      setCsvFeedback('No valid rows found. Format: title,level,skill,type,url,description');
      return;
    }
    setImportingCsv(true);
    setCsvFeedback('');
    try {
      const now = serverTimestamp();
      for (const row of rows) {
        await addDoc(collection(db, 'resources'), {
          ...row,
          addedBy: (myProfile?.displayName || 'Tr Hein Tay Za').slice(0, 120),
          addedByUid: user.uid,
          approved: true,
          openCount: 0,
          usedCount: 0,
          thumbsUp: 0,
          thumbsDown: 0,
          isSample: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      setCsvFeedback(`Imported ${rows.length} resources into the library!`);
      setCsvText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'resources/csv');
    } finally {
      setImportingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Resource Library"
        inShort={PAGE_SUMMARIES.resources}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setCsvFeedback('');
                  setShowCsvModal(true);
                }}
                className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-sm font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Bulk CSV
              </button>
            )}
            {canInteract && (
              <button
                type="button"
                onClick={() => openAddModal()}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {isAdmin ? 'Add resource' : 'Suggest a resource'}
              </button>
            )}
          </div>
        }
      />

      {/* Pending Teacher Suggestions Banner (Admin approves; teachers see own pending) */}
      {pendingSuggestions.length > 0 && (
        <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#A8567F]/40 p-5 space-y-3">
          <h2 className="text-sm font-bold text-[#3B1050] dark:text-[#E8D5F5]">
            {isAdmin
              ? `Pending Teacher Suggestions (${pendingSuggestions.length})`
              : `Your Suggested Resources Waiting for Approval (${pendingSuggestions.length})`}
          </h2>
          <div className="space-y-2.5">
            {pendingSuggestions.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 text-sm">
                  <p className="font-bold text-[#1F122B] dark:text-[#F5EEF9]">{item.title}</p>
                  <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                    {item.level} · {item.skill} · {item.type} · Suggested by {item.addedBy}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E5D9EC] text-xs font-semibold"
                    >
                      Check link
                    </a>
                    <button
                      type="button"
                      onClick={() => handleApproveSuggestion(item)}
                      className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteResource(item.id)}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      aria-label="Reject suggestion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Personal Area Tabs + Search & Filters */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] w-fit">
          {(
            [
              { id: 'all', label: `All Library (${approvedResources.length})` },
              {
                id: 'bookmarks',
                label: `My Bookmarks (${Object.values(myResourceStates).filter((s) => s.bookmarked).length})`,
              },
              { id: 'recent', label: 'Recently Opened' },
              { id: 'notes', label: 'My Notes' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setScope(t.id)}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                scope === t.id
                  ? 'bg-[#3B1050] text-white'
                  : 'text-[#5A4A66] dark:text-[#C5B4D4] hover:bg-[#F4EEF7] dark:hover:bg-[#2A1D38]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-6 relative">
            <Search className="w-4 h-4 text-[#7A6888] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search resources (e.g., "pronunciation B1" or "lesson plan")...'
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
            />
          </div>
          <select
            aria-label="Filter by CEFR level"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="lg:col-span-2 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                Level: {l}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by skill"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="lg:col-span-2 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
          >
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                Skill: {s}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="lg:col-span-2 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                Type: {t}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Resource List */}
      {filteredResources.length === 0 ? (
        <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-10 text-center space-y-2">
          <FolderOpen className="w-8 h-8 text-[#BBAAC9] mx-auto" />
          <p className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
            {scope === 'bookmarks'
              ? 'No bookmarked resources yet'
              : scope === 'recent'
                ? 'You have not opened any resources yet'
                : scope === 'notes'
                  ? 'You have not saved any personal notes yet'
                  : 'No resources match your search'}
          </p>
          <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
            Try clearing a filter or suggest a new teaching link for the team.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResources.map((r) => {
            const state = myResourceStates[r.id];
            const embed = getEmbedPreviewUrl(r.url);
            const showPreview = previewId === r.id && embed.kind === 'iframe';
            const showNote = noteOpenId === r.id;
            const showRateComment = ratingCommentOpenId === r.id;

            return (
              <article
                key={r.id}
                className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <p className="text-xs text-[#7A6888] dark:text-[#9D8AAD]">
                      <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        {r.level}
                      </span>
                      {' · '}
                      {r.skill}
                      {' · '}
                      {r.type}
                      {' · '}
                      Added by {r.addedBy}
                    </p>
                    <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] leading-snug">
                      {r.title}
                    </h3>
                    {r.description && (
                      <p className="text-sm text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                        {r.description}
                      </p>
                    )}
                    {state?.personalNote && !showNote && (
                      <p className="text-xs text-[#3B1050] dark:text-[#E2B8D0] bg-[#FAF7FC] dark:bg-[#160F1F] px-3 py-2 rounded-lg mt-2">
                        <strong>My note:</strong> {state.personalNote}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-2 shrink-0">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleOpenResource(r)}
                      className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open resource
                    </a>
                    {embed.kind === 'iframe' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!showPreview) handleOpenResource(r);
                          setPreviewId(showPreview ? null : r.id);
                        }}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#F4EEF7] dark:hover:bg-[#2A1D38] whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showPreview ? 'Hide preview' : 'Preview inside page'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Embedded Preview Frame (Google Slides, Docs, Drive, YouTube, PDF) */}
                {showPreview && (
                  <div className="rounded-xl overflow-hidden border border-[#E5D9EC] dark:border-[#332442] bg-black/5">
                    <iframe
                      src={embed.src}
                      title={`Preview of ${r.title}`}
                      className="w-full h-[380px] sm:h-[460px]"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {/* Action Bar: Bookmark, I used this, Rate, My Note, Admin Edit/Delete */}
                <div className="pt-3 border-t border-[#F0E6F5] dark:border-[#2E203D] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => upsertState(r.id, { bookmarked: !state?.bookmarked })}
                      className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        state?.bookmarked
                          ? 'bg-[#3B1050] text-white'
                          : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                      }`}
                    >
                      {state?.bookmarked ? (
                        <BookmarkCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                      {state?.bookmarked ? 'Bookmarked' : 'Bookmark'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleUsed(r)}
                      className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        state?.used
                          ? 'bg-emerald-700 text-white'
                          : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {state?.used ? 'I used this ✓' : 'I used this'}
                      <span className="tabular-nums opacity-80">({r.usedCount || 0})</span>
                    </button>

                    <div className="inline-flex items-center rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] p-0.5">
                      <button
                        type="button"
                        onClick={() => handleRate(r, 'up')}
                        className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          state?.rating === 'up'
                            ? 'bg-white dark:bg-[#3B1050] text-[#3B1050] dark:text-white shadow-xs'
                            : 'text-[#5A4A66] dark:text-[#BBAAC9]'
                        }`}
                        aria-label="Thumbs up"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{r.thumbsUp || 0}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRate(r, 'down')}
                        className={`min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          state?.rating === 'down'
                            ? 'bg-white dark:bg-[#3B1050] text-[#3B1050] dark:text-white shadow-xs'
                            : 'text-[#5A4A66] dark:text-[#BBAAC9]'
                        }`}
                        aria-label="Thumbs down"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{r.thumbsDown || 0}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (showNote) {
                          setNoteOpenId(null);
                        } else {
                          setNoteDraft(state?.personalNote || '');
                          setNoteOpenId(r.id);
                        }
                      }}
                      className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5] text-xs font-semibold"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      My note
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#7A6888] dark:text-[#9D8AAD] tabular-nums">
                    <span>Opened {r.openCount || 0}×</span>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openAddModal(r)}
                          className="font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteResource(r.id)}
                          className="font-semibold text-red-600 dark:text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Optional Rating Comment Box */}
                {showRateComment && (
                  <div className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      maxLength={400}
                      value={ratingCommentDraft}
                      onChange={(e) => setRatingCommentDraft(e.target.value)}
                      placeholder="Optional short comment on how this worked in your class..."
                      className="flex-1 min-h-[40px] px-3 py-1.5 rounded-lg border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await upsertState(r.id, { ratingComment: ratingCommentDraft });
                          setRatingCommentOpenId(null);
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#3B1050] text-white text-xs font-semibold"
                      >
                        Save comment
                      </button>
                      <button
                        type="button"
                        onClick={() => setRatingCommentOpenId(null)}
                        className="text-xs text-[#5A4A66]"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}

                {/* Personal Note Editor */}
                {showNote && (
                  <div className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-2">
                    <label className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] flex items-center gap-1.5">
                      <MessageSquareText className="w-3.5 h-3.5" />
                      My private teaching notes (only visible to you)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="e.g., Skip slide 4 for A2 students — breakout task took 12 minutes."
                      className="w-full px-3 py-2 rounded-lg border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setNoteOpenId(null)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#E5D9EC] text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await upsertState(r.id, { personalNote: noteDraft });
                          setNoteOpenId(null);
                        }}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#3B1050] text-white text-xs font-semibold"
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Add / Suggest Resource Modal */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowAddForm(false)}
        >
          <form
            onSubmit={handleSaveResource}
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                {editingRes
                  ? 'Edit Resource'
                  : isAdmin
                    ? 'Add Resource to Library'
                    : 'Suggest a Resource for YAO'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {!isAdmin && (
              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
                Your suggestion goes to Tr Hein for a quick check before appearing in the shared
                library.
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  maxLength={180}
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  placeholder="e.g., B1 Speaking Warm-Up Slides"
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold mb-1">CEFR Level</label>
                  <select
                    value={fLevel}
                    onChange={(e) => setFLevel(e.target.value)}
                    className="w-full min-h-[42px] px-2.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
                  >
                    {LEVELS.filter((x) => x !== 'All').map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Skill</label>
                  <select
                    value={fSkill}
                    onChange={(e) => setFSkill(e.target.value)}
                    className="w-full min-h-[42px] px-2.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
                  >
                    {SKILLS.filter((x) => x !== 'All').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Type</label>
                  <select
                    value={fType}
                    onChange={(e) => setFType(e.target.value)}
                    className="w-full min-h-[42px] px-2.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs"
                  >
                    {TYPES.filter((x) => x !== 'All').map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Link (Google Drive / Docs / Slides / YouTube / PDF) *
                </label>
                <input
                  type="url"
                  required
                  maxLength={600}
                  value={fUrl}
                  onChange={(e) => setFUrl(e.target.value)}
                  placeholder="https://docs.google.com/..."
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Short description</label>
                <textarea
                  rows={3}
                  maxLength={800}
                  value={fDesc}
                  onChange={(e) => setFDesc(e.target.value)}
                  placeholder="How can a teacher use this in a Zoom lesson?"
                  className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingRes}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
              >
                {savingRes ? 'Saving...' : isAdmin ? 'Save resource' : 'Submit suggestion'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin CSV Bulk Import Modal */}
      {isAdmin && showCsvModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCsvModal(false)}
        >
          <form
            onSubmit={handleCsvImport}
            onClick={(e) => e.stopPropagation()}
            className="max-w-xl w-full bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                Bulk Import Resources from CSV
              </h3>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              Paste CSV lines with columns: <code className="font-mono">title,level,skill,type,url,description</code>
            </p>
            <textarea
              rows={6}
              required
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`title,level,skill,type,url,description\n"A2 Listening Audio Unit 2",A2,Listening,Audio,https://drive.google.com/file/d/abc/view,"Clear slow-speed audio clip"`}
              className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-xs font-mono"
            />
            {csvFeedback && (
              <p className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0]">{csvFeedback}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5D9EC] text-xs font-medium"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={importingCsv}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
              >
                {importingCsv ? 'Importing...' : 'Import CSV rows'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
