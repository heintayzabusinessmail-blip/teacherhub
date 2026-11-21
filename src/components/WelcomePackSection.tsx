import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Play,
  Plus,
  Sparkles,
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
import { getEmbedPreviewUrl } from '../utils/helpers';
import type { NavTab, WelcomePackCategory, WelcomeProgressDoc } from '../types';

interface WelcomePackSectionProps {
  onNavigate: (tab: NavTab) => void;
}

const CATEGORY_LABELS: Record<WelcomePackCategory, string> = {
  organisation: 'YAO Organisation',
  academic: 'Academic Structure',
  zoom_tools: 'Zoom Tools',
  curriculum: 'Coursebooks & Levels',
};

const READINESS_ITEMS: Array<{
  key: keyof Pick<
    WelcomeProgressDoc,
    | 'watchedOrientation'
    | 'reviewedCoursebook'
    | 'zoomScreenShareReady'
    | 'zoomAudioShareReady'
    | 'zoomBreakoutRoomsReady'
    | 'practiceLessonDone'
  >;
  label: string;
  hint: string;
}> = [
  {
    key: 'watchedOrientation',
    label: 'Watched YAO organisation & academic orientation video',
    hint: 'Understand how YAO classes, schedules, and teacher support work.',
  },
  {
    key: 'reviewedCoursebook',
    label: 'Walked through my level, learning outcomes & coursebook',
    hint: 'Check your level units and materials in the Resource Library & Roadmap.',
  },
  {
    key: 'zoomScreenShareReady',
    label: 'Practised Zoom Screen Share (slides & whiteboard)',
    hint: 'Switch smoothly between slides and chat without losing students.',
  },
  {
    key: 'zoomAudioShareReady',
    label: 'Practised Zoom Computer Audio Share (listening tracks)',
    hint: 'Check "Share sound" before playing coursebook listening audio.',
  },
  {
    key: 'zoomBreakoutRoomsReady',
    label: 'Practised opening & monitoring Zoom Breakout Rooms',
    hint: 'Give short instructions + 1 ICQ before sending pairs into rooms.',
  },
  {
    key: 'practiceLessonDone',
    label: 'Completed short practice lesson with friendly feedback',
    hint: 'Never drop into your first class alone — rehearse a 10-min stage with Tr Hein.',
  },
];

export function WelcomePackSection({ onNavigate }: WelcomePackSectionProps) {
  const { user, isAdmin, canInteract, myProfile, welcomePackItems, myWelcomeProgress } = useHub();

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [wTitle, setWTitle] = useState('');
  const [wCategory, setWCategory] = useState<WelcomePackCategory>('organisation');
  const [wUrl, setWUrl] = useState('');
  const [wDuration, setWDuration] = useState('5–10 mins');
  const [wDesc, setWDesc] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [busyFlag, setBusyFlag] = useState<string | null>(null);

  const readinessCompleted = useMemo(() => {
    if (!myWelcomeProgress) return 0;
    return READINESS_ITEMS.filter((item) => Boolean(myWelcomeProgress[item.key])).length;
  }, [myWelcomeProgress]);

  const progressPct = Math.round((readinessCompleted / READINESS_ITEMS.length) * 100);

  const handleToggleReadiness = async (key: (typeof READINESS_ITEMS)[number]['key']) => {
    if (!user || !myProfile || !canInteract) return;
    setBusyFlag(key);
    try {
      const ref = doc(db, 'teachers', user.uid, 'welcomeProgress', 'current');
      const nextPayload = {
        teacherName: myProfile.displayName.slice(0, 120),
        watchedOrientation: myWelcomeProgress?.watchedOrientation ?? false,
        reviewedCoursebook: myWelcomeProgress?.reviewedCoursebook ?? false,
        zoomScreenShareReady: myWelcomeProgress?.zoomScreenShareReady ?? false,
        zoomAudioShareReady: myWelcomeProgress?.zoomAudioShareReady ?? false,
        zoomBreakoutRoomsReady: myWelcomeProgress?.zoomBreakoutRoomsReady ?? false,
        practiceLessonDone: myWelcomeProgress?.practiceLessonDone ?? false,
        [key]: !(myWelcomeProgress?.[key] ?? false),
        updatedAt: serverTimestamp(),
      };

      if (myWelcomeProgress) {
        await updateDoc(ref, nextPayload);
      } else {
        await setDoc(ref, {
          uid: user.uid,
          ...nextPayload,
        });
      }
    } catch (err) {
      handleFirestoreError(
        err,
        myWelcomeProgress ? OperationType.UPDATE : OperationType.CREATE,
        `teachers/${user.uid}/welcomeProgress/current`
      );
    } finally {
      setBusyFlag(null);
    }
  };

  const handleAddWelcomeItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !wTitle.trim() || !wUrl.trim()) return;
    setSavingItem(true);
    try {
      await addDoc(collection(db, 'welcomePackItems'), {
        title: wTitle.trim().slice(0, 160),
        category: wCategory,
        description: wDesc.trim().slice(0, 500),
        mediaUrl: wUrl.trim().slice(0, 600),
        durationLabel: wDuration.trim().slice(0, 40),
        order: Math.min(100, welcomePackItems.length + 1),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setWTitle('');
      setWUrl('');
      setWDesc('');
      setWDuration('5–10 mins');
      setShowAddForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'welcomePackItems');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteWelcomeItem = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'welcomePackItems', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `welcomePackItems/${id}`);
    }
  };

  return (
    <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-[#A8567F] dark:text-[#D98EB3] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Month 1 · Week 3 Deliverable (Job #1)
          </p>
          <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
            New Teacher Welcome Pack &amp; Zoom Readiness
          </h2>
          <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            Watch YAO’s short orientation videos and tick off your pre-class Zoom readiness steps so
            you feel confident before your first class.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5] tabular-nums">
            {readinessCompleted} / {READINESS_ITEMS.length} ready ({progressPct}%)
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
            >
              {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddForm ? 'Close' : 'Add video / guide'}
            </button>
          )}
        </div>
      </div>

      {/* Admin Add Orientation Video / Guide Form */}
      {isAdmin && showAddForm && (
        <form
          onSubmit={handleAddWelcomeItem}
          className="rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#A8567F]/40 p-4 space-y-3"
        >
          <p className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
            Add Recorded Orientation Video or Welcome Guide (YouTube, Google Drive, Slides, or PDF)
          </p>
          <div className="grid sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              required
              maxLength={160}
              value={wTitle}
              onChange={(e) => setWTitle(e.target.value)}
              placeholder="Title (e.g., Welcome to YAO Academic Structure)"
              className="sm:col-span-2 min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
            />
            <select
              value={wCategory}
              onChange={(e) => setWCategory(e.target.value as WelcomePackCategory)}
              className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
            >
              <option value="organisation">YAO Organisation</option>
              <option value="academic">Academic Structure</option>
              <option value="zoom_tools">Zoom Tools</option>
              <option value="curriculum">Coursebooks &amp; Levels</option>
            </select>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            <input
              type="url"
              required
              maxLength={600}
              value={wUrl}
              onChange={(e) => setWUrl(e.target.value)}
              placeholder="YouTube, Google Drive, or Slides URL"
              className="sm:col-span-2 min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
            />
            <input
              type="text"
              maxLength={40}
              value={wDuration}
              onChange={(e) => setWDuration(e.target.value)}
              placeholder="Length (e.g., 8 mins)"
              className="min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
            />
          </div>
          <textarea
            rows={2}
            maxLength={500}
            value={wDesc}
            onChange={(e) => setWDesc(e.target.value)}
            placeholder="Short summary of what teachers will learn from this video or guide..."
            className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#E5D9EC] text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingItem}
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-xs font-semibold disabled:opacity-50"
            >
              {savingItem ? 'Saving...' : 'Publish to Welcome Pack'}
            </button>
          </div>
        </form>
      )}

      {/* Orientation Videos & Guides */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-1.5">
          <Video className="w-4 h-4 text-[#A8567F]" />
          Recorded Orientation Videos &amp; Welcome Guides ({welcomePackItems.length})
        </h3>

        {welcomePackItems.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] text-xs text-[#5A4A66] dark:text-[#BBAAC9] space-y-1">
            <p className="font-semibold text-[#1F122B] dark:text-[#F5EEF9]">
              Orientation videos are coming in Week 3!
            </p>
            <p>
              {isAdmin
                ? 'Click "Add video / guide" above to post YouTube or Google Drive recordings covering YAO’s organisation, academic structure, and Zoom classroom tools.'
                : 'Tr Hein will post short orientation videos here covering YAO’s organisation, academic structure, and Zoom tips.'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {welcomePackItems.map((item) => {
              const embed = getEmbedPreviewUrl(item.mediaUrl);
              const isOpen = previewId === item.id;
              return (
                <article
                  key={item.id}
                  className="p-4 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#241633] border border-[#E5D9EC] dark:border-[#3E2D52] text-[11px] font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                        {CATEGORY_LABELS[item.category]}
                        {item.durationLabel ? ` · ${item.durationLabel}` : ''}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteWelcomeItem(item.id)}
                          className="p-1 rounded-lg text-[#7A6888] hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Delete welcome pack item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {isOpen && embed.kind === 'iframe' && (
                    <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#E5D9EC] dark:border-[#332442] bg-black">
                      <iframe
                        src={embed.src}
                        title={item.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {embed.kind === 'iframe' && (
                      <button
                        type="button"
                        onClick={() => setPreviewId(isOpen ? null : item.id)}
                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
                      >
                        <Play className="w-3.5 h-3.5" />
                        {isOpen ? 'Hide player' : 'Watch here'}
                      </button>
                    )}
                    <a
                      href={item.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
                    >
                      Open link
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 6-Step Pre-Class & Zoom Readiness Checklist */}
      <div className="space-y-3 pt-2 border-t border-[#F0E6F5] dark:border-[#2E203D]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9]">
            Pre-Class &amp; Zoom Tools Readiness Checklist
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('meetings')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
          >
            Book a practice lesson slot
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-2 rounded-full bg-[#F0E6F5] dark:bg-[#2A1D38] overflow-hidden">
          <div
            className="h-full bg-emerald-600 dark:bg-emerald-400 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <ul className="grid sm:grid-cols-2 gap-2.5">
          {READINESS_ITEMS.map((item) => {
            const checked = Boolean(myWelcomeProgress?.[item.key]);
            return (
              <li key={item.key}>
                <button
                  type="button"
                  disabled={!canInteract || !myProfile || busyFlag === item.key}
                  onClick={() => handleToggleReadiness(item.key)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors flex items-start gap-2.5 disabled:opacity-60 ${
                    checked
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-[#FAF7FC] dark:bg-[#160F1F] border-[#E5D9EC] dark:border-[#332442] hover:border-[#C5A9D6]'
                  }`}
                >
                  {checked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-[#BBAAC9] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold leading-snug ${
                        checked
                          ? 'text-emerald-900 dark:text-emerald-200 line-through'
                          : 'text-[#1F122B] dark:text-[#F5EEF9]'
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5">
                      {item.hint}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
