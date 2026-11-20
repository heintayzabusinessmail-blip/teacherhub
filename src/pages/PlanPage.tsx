import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import {
  BRAND,
  COORDINATOR_JOB_STEPS,
  COORDINATOR_PROFILE,
  JARGON_GLOSSARY,
  PAGE_SUMMARIES,
  TEACHER_PROMISES,
  TEACHING_PORTFOLIO_ITEMS,
} from '../content/planContent';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PageHeader } from '../components/PageHeader';
import { compressImageFileToDataUrl, getEmbedPreviewUrl } from '../utils/helpers';
import { downloadPlanPdf } from '../utils/pdfExport';

export function PlanPage() {
  const { isAdmin, galleryItems } = useHub();
  const [expandedSteps, setExpandedSteps] = useState<number[]>([1]);
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    src: string;
    title: string;
    caption?: string;
  } | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'photo' | 'video'>('all');

  // Admin Gallery Form State
  const [showGalleryForm, setShowGalleryForm] = useState(false);
  const [gTitle, setGTitle] = useState('');
  const [gLocation, setGLocation] = useState('');
  const [gCategory, setGCategory] = useState('Mentoring');
  const [gType, setGType] = useState<'photo' | 'youtube' | 'drive'>('youtube');
  const [gUrl, setGUrl] = useState('');
  const [gCaption, setGCaption] = useState('');
  const [savingGallery, setSavingGallery] = useState(false);

  const toggleStep = (num: number) => {
    setExpandedSteps((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const expandAll = () => setExpandedSteps(COORDINATOR_JOB_STEPS.map((s) => s.number));
  const collapseAll = () => setExpandedSteps([]);

  const handleDownloadPdf = () => {
    downloadPlanPdf();
  };

  // Combine Firestore admin gallery items (newest first) with curated portfolio photos & videos
  const combinedGallery = [
    ...galleryItems.map((item) => ({ ...item, isBuiltIn: false })),
    ...TEACHING_PORTFOLIO_ITEMS.map((item) => ({ ...item, isBuiltIn: true })),
  ].filter((item) => {
    if (galleryFilter === 'photo') return item.mediaType === 'photo';
    if (galleryFilter === 'video') return item.mediaType === 'youtube' || item.mediaType === 'drive';
    return true;
  });

  const handleGalleryPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 640, 0.78);
      setGUrl(dataUrl);
      setGType('photo');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gTitle.trim()) return;
    setSavingGallery(true);
    try {
      await addDoc(collection(db, 'galleryItems'), {
        title: gTitle.trim().slice(0, 150),
        location: gLocation.trim().slice(0, 100),
        category: gCategory.trim().slice(0, 80),
        mediaType: gType,
        mediaUrl: gUrl.trim().slice(0, 150000),
        caption: gCaption.trim().slice(0, 400),
        isSample: false,
        createdAt: serverTimestamp(),
      });
      setGTitle('');
      setGLocation('');
      setGUrl('');
      setGCaption('');
      setShowGalleryForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'galleryItems');
    } finally {
      setSavingGallery(false);
    }
  };

  const handleDeleteGalleryItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'galleryItems', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `galleryItems/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="About Me & Our Plan: Meet Your Coordinator & My 9 Jobs"
        inShort={PAGE_SUMMARIES.plan}
        action={
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download as PDF
          </button>
        }
      />

      {/* Section 1: Meet Tr Hein */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                About Your Academic Coordinator
              </p>
              <h2 className="text-2xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                {COORDINATOR_PROFILE.headline}
              </h2>
              <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
                {COORDINATOR_PROFILE.location}
              </p>
              <p className="text-xs font-medium text-[#3B1050] dark:text-[#E2B8D0]">
                Languages: {COORDINATOR_PROFILE.languages}
              </p>
            </div>

            <p className="text-base text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
              {COORDINATOR_PROFILE.shortProfile}
            </p>

            {/* How this helps YAO teachers */}
            <div className="rounded-2xl bg-[#F4EEF7] dark:bg-[#2A1D38] p-5 space-y-3 border border-[#E5D9EC] dark:border-[#3E2D52]">
              <h3 className="text-sm font-bold text-[#3B1050] dark:text-[#E8D5F5] flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#A8567F]" />
                How this helps YAO teachers
              </h3>
              <p className="text-sm text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                {COORDINATOR_PROFILE.howThisHelpsYao.body}
              </p>
              <blockquote className="text-sm italic font-medium text-[#3B1050] dark:text-[#F5EEF9]">
                Feedback from my own YAO students: {COORDINATOR_PROFILE.howThisHelpsYao.studentQuote}
              </blockquote>
              <p className="text-sm font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                {COORDINATOR_PROFILE.howThisHelpsYao.closingWish}
              </p>
            </div>
          </div>

          {/* Coordinator YAO Poster Card */}
          <div className="lg:col-span-4 space-y-2">
            <button
              type="button"
              onClick={() =>
                setLightboxPhoto({
                  src: BRAND.coordinatorPosterPath,
                  title: 'Mr Hein Tay Za — YAO English Teacher Welcome Poster',
                })
              }
              className="group block w-full overflow-hidden rounded-2xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-left focus:outline-none focus:ring-2 focus:ring-[#A8567F]"
            >
              <img
                src={BRAND.coordinatorPosterPath}
                alt="Mr Hein Tay Za — YAO English Teacher introduction poster"
                className="w-full h-auto object-cover group-hover:scale-[1.01] transition-transform duration-200"
                referrerPolicy="no-referrer"
              />
              <div className="px-3.5 py-2.5 text-xs font-medium text-[#3B1050] dark:text-[#E2B8D0] flex items-center justify-between no-print">
                <span>Tap to view full welcome poster</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>

        {/* Qualification Badges */}
        <div className="pt-6 border-t border-[#E5D9EC] dark:border-[#332442] space-y-4 print-break-avoid">
          <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#A8567F]" />
            Qualifications & Credentials
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COORDINATOR_PROFILE.qualifications.map((q) => (
              <div
                key={q.title}
                className="rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] p-4 space-y-1.5"
              >
                <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3] tabular-nums">
                  {q.year}
                </p>
                <h4 className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] leading-snug">
                  {q.title}
                </h4>
                <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">{q.org}</p>
                <p className="text-xs font-medium text-[#3B1050] dark:text-[#E2B8D0]">{q.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Experience Timeline + Curriculum Built Card */}
        <div className="pt-6 border-t border-[#E5D9EC] dark:border-[#332442] grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9] flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#A8567F]" />
              Experience Timeline
            </h3>
            <ol className="relative space-y-5 pl-5 border-l border-[#E5D9EC] dark:border-[#3E2D52]">
              {COORDINATOR_PROFILE.experienceTimeline.map((exp) => (
                <li key={exp.role} className="relative space-y-1 print-break-avoid">
                  <span
                    className="absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#3B1050] dark:bg-[#D98EB3] ring-4 ring-white dark:ring-[#1F1629]"
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#7A6888] dark:text-[#9D8AAD] tabular-nums">
                    <span className="font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                      {exp.period}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{exp.location}</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                    {exp.role}
                  </h4>
                  <p className="text-sm text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                    {exp.summary}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:col-span-5 space-y-5">
            {/* Separate Curriculum & Materials Built Card (no employer name) */}
            <div className="rounded-2xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] p-5 space-y-3 print-break-avoid">
              <h3 className="text-base font-bold text-[#3B1050] dark:text-[#E8D5F5] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#A8567F]" />
                Curriculum & Materials I Have Built
              </h3>
              <ul className="space-y-2.5 text-sm text-[#3A2847] dark:text-[#DFD0EC]">
                {COORDINATOR_PROFILE.curriculumBuilt.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#A8567F] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Professional Development */}
            <div className="rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 space-y-3 print-break-avoid">
              <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                Professional Development
              </h3>
              <ul className="space-y-2 text-sm text-[#5A4A66] dark:text-[#C5B4D4]">
                {COORDINATOR_PROFILE.professionalDevelopment.map((pd) => (
                  <li key={pd}>• {pd}</li>
                ))}
              </ul>
            </div>

            {/* Community */}
            <div className="rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 space-y-3 print-break-avoid">
              <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                Community & Speaking Clubs
              </h3>
              <ul className="space-y-2 text-sm text-[#5A4A66] dark:text-[#C5B4D4]">
                {COORDINATOR_PROFILE.community.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Key Skills Chips */}
        <div className="pt-6 border-t border-[#E5D9EC] dark:border-[#332442] space-y-3 print-break-avoid">
          <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
            Key Skills I Bring to YAO
          </h3>
          <div className="flex flex-wrap gap-2">
            {COORDINATOR_PROFILE.keySkills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1.5 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5] text-xs sm:text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: My Teaching in Action Gallery */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              My Teaching in Action
            </h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Photos and videos from mentoring, Business English presentations, Hysan Education
              events, and online speaking clubs in Dubai and Myanmar.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowGalleryForm((v) => !v)}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold whitespace-nowrap no-print"
            >
              <Plus className="w-4 h-4" />
              Add photo or video
            </button>
          )}
        </div>

        {isAdmin && showGalleryForm && (
          <form
            onSubmit={handleAddGalleryItem}
            className="p-5 rounded-2xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] space-y-4 no-print"
          >
            <div className="grid sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                maxLength={150}
                value={gTitle}
                onChange={(e) => setGTitle(e.target.value)}
                placeholder="Title (e.g., Business English Presentation)"
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
              <input
                type="text"
                maxLength={100}
                value={gLocation}
                onChange={(e) => setGLocation(e.target.value)}
                placeholder="Location (e.g., Dubai / Myanmar)"
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              />
              <select
                value={gCategory}
                onChange={(e) => setGCategory(e.target.value)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
              >
                <option value="Mentoring">Mentoring</option>
                <option value="Business English">Business English</option>
                <option value="Community & Leadership">Community & Leadership</option>
                <option value="Virtual Engagement">Virtual Engagement</option>
                <option value="Classroom Teaching">Classroom Teaching</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442]">
                {(['youtube', 'drive', 'photo'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setGType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      gType === t
                        ? 'bg-[#3B1050] text-white'
                        : 'text-[#5A4A66] dark:text-[#BBAAC9]'
                    }`}
                  >
                    {t === 'youtube' ? 'YouTube link' : t === 'drive' ? 'Google Drive link' : 'Upload photo'}
                  </button>
                ))}
              </div>

              {gType === 'photo' ? (
                <label className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs font-semibold cursor-pointer">
                  <Upload className="w-4 h-4 text-[#A8567F]" />
                  {gUrl ? 'Photo ready (change)' : 'Choose photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGalleryPhotoUpload}
                    className="hidden"
                  />
                </label>
              ) : (
                <input
                  type="url"
                  required
                  value={gUrl}
                  onChange={(e) => setGUrl(e.target.value)}
                  placeholder={
                    gType === 'youtube'
                      ? 'Paste YouTube URL (https://youtube.com/watch?v=...)'
                      : 'Paste Google Drive file link (https://drive.google.com/file/d/...)'
                  }
                  className="flex-1 min-w-[240px] min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
                />
              )}
            </div>

            <input
              type="text"
              maxLength={400}
              value={gCaption}
              onChange={(e) => setGCaption(e.target.value)}
              placeholder="Short caption describing the activity"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-sm"
            />

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingGallery}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
              >
                {savingGallery ? 'Saving...' : 'Save to gallery'}
              </button>
              <button
                type="button"
                onClick={() => setShowGalleryForm(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2 no-print">
          {(
            [
              { id: 'all', label: `All (${galleryItems.length + TEACHING_PORTFOLIO_ITEMS.length})` },
              {
                id: 'photo',
                label: `Photos (${
                  galleryItems.filter((i) => i.mediaType === 'photo').length +
                  TEACHING_PORTFOLIO_ITEMS.filter((i) => i.mediaType === 'photo').length
                })`,
              },
              {
                id: 'video',
                label: `Videos (${
                  galleryItems.filter((i) => i.mediaType !== 'photo').length +
                  TEACHING_PORTFOLIO_ITEMS.filter((i) => i.mediaType !== 'photo').length
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setGalleryFilter(tab.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                galleryFilter === tab.id
                  ? 'bg-[#3B1050] text-white'
                  : 'bg-[#FAF7FC] dark:bg-[#160F1F] text-[#5A4A66] dark:text-[#BBAAC9] border border-[#E5D9EC] dark:border-[#332442] hover:bg-[#F4EEF7] dark:hover:bg-[#271B34]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {combinedGallery.map((item) => {
            const embed = getEmbedPreviewUrl(item.mediaUrl);
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#160F1F] overflow-hidden flex flex-col justify-between print-break-avoid"
              >
                <div>
                  {item.mediaType === 'photo' && item.mediaUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxPhoto({
                          src: item.mediaUrl,
                          title: item.title,
                          caption: item.caption,
                        })
                      }
                      className="group block w-full aspect-[4/3] overflow-hidden bg-[#160F1F] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#A8567F]"
                    >
                      <img
                        src={item.mediaUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ) : (item.mediaType === 'youtube' || item.mediaType === 'drive') &&
                    embed.kind === 'iframe' ? (
                    <div className="w-full aspect-video bg-black">
                      <iframe
                        src={embed.src}
                        title={item.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-[#F4EEF7] dark:bg-[#2A1D38] flex flex-col items-center justify-center p-4 text-center gap-2">
                      <ImageIcon className="w-8 h-8 text-[#A8567F]" />
                      <span className="text-xs font-medium text-[#5A4A66] dark:text-[#BBAAC9]">
                        Media preview unavailable
                      </span>
                    </div>
                  )}

                  <div className="p-4 space-y-1.5">
                    <p className="text-xs text-[#7A6888] dark:text-[#9D8AAD]">
                      {item.category}
                      {item.location ? ` · ${item.location}` : ''}
                    </p>
                    <h3 className="text-sm sm:text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                      {item.title}
                    </h3>
                    {item.caption && (
                      <p className="text-xs sm:text-sm text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                        {item.caption}
                      </p>
                    )}
                  </div>
                </div>

                {isAdmin && !item.isBuiltIn && (
                  <div className="px-4 pb-3 flex justify-end no-print">
                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryItem(item.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Section 3: My Job in 9 Steps */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              My Job in 9 Simple Steps
            </h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Tap any step to see what I will do, how I will do it, and what you can expect.
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={expandAll}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9]"
            >
              Collapse all
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {COORDINATOR_JOB_STEPS.map((step) => {
            const isOpen = expandedSteps.includes(step.number);
            return (
              <div
                key={step.number}
                className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] overflow-hidden shadow-xs print-break-avoid"
              >
                <button
                  type="button"
                  onClick={() => toggleStep(step.number)}
                  aria-expanded={isOpen}
                  className="w-full min-h-[56px] px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#FAF7FC] dark:hover:bg-[#271B34] transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-8 h-8 rounded-xl bg-[#3B1050] text-white text-sm font-bold flex items-center justify-center shrink-0 tabular-nums">
                      {step.number}
                    </span>
                    <span className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                      {step.title}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-[#5A4A66] dark:text-[#BBAAC9] shrink-0 no-print" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#5A4A66] dark:text-[#BBAAC9] shrink-0 no-print" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-[#F0E6F5] dark:border-[#2E203D] grid md:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#A8567F] dark:text-[#D98EB3]">What</p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">{step.what}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#A8567F] dark:text-[#D98EB3]">How</p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">{step.how}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[#3B1050] dark:text-[#E8D5F5]">
                        What you can expect as a teacher
                      </p>
                      <p className="text-[#3A2847] dark:text-[#DFD0EC] leading-relaxed">
                        {step.expect}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 4: Teacher Promises */}
      <section className="bg-[#3B1050] text-white rounded-2xl p-6 sm:p-8 shadow-sm space-y-4 print-break-avoid">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#E8B7D0]">My Promise to Every Teacher</p>
          <h2 className="text-xl font-bold">What you can always expect from me</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {TEACHER_PROMISES.map((promise, idx) => (
            <div
              key={promise}
              className="rounded-xl bg-white/10 border border-white/15 p-4 flex items-start gap-3"
            >
              <span className="text-sm font-bold text-[#E8B7D0] tabular-nums">0{idx + 1}.</span>
              <p className="text-sm leading-relaxed text-white/95">{promise}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 5: Simple Plain-English Glossary */}
      <section className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 shadow-sm space-y-4 print-break-avoid">
        <div>
          <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
            Teaching Terms in Plain English
          </h2>
          <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
            We avoid unexplained jargon — here is a quick one-line meaning for every short term used
            in this hub.
          </p>
        </div>
        <dl className="grid sm:grid-cols-2 gap-4">
          {JARGON_GLOSSARY.map((item) => (
            <div
              key={item.term}
              className="p-3.5 rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442]"
            >
              <dt className="text-sm font-bold text-[#3B1050] dark:text-[#E2B8D0]">{item.term}</dt>
              <dd className="text-xs sm:text-sm text-[#5A4A66] dark:text-[#C5B4D4] mt-1 leading-relaxed">
                {item.explanation}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Unified Photo & Poster Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] overflow-auto bg-white dark:bg-[#1F1629] rounded-2xl p-3 sm:p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                  {lightboxPhoto.title}
                </h3>
                {lightboxPhoto.caption && (
                  <p className="text-xs sm:text-sm text-[#5A4A66] dark:text-[#C5B4D4] mt-0.5">
                    {lightboxPhoto.caption}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="shrink-0 min-h-[40px] min-w-[40px] rounded-full bg-[#3B1050] text-white inline-flex items-center justify-center shadow-md"
                aria-label="Close photo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={lightboxPhoto.src}
              alt={lightboxPhoto.title}
              className="w-full h-auto max-h-[72vh] object-contain rounded-xl bg-[#FAF7FC] dark:bg-[#140D1A]"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
