import React, { useMemo, useState } from 'react';
import {
  Camera,
  Edit3,
  Heart,
  MessageCircle,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { PAGE_SUMMARIES } from '../content/planContent';
import { PageHeader } from '../components/PageHeader';
import { compressImageFileToDataUrl, getInitials } from '../utils/helpers';
import { getMissingTeacherProfileFields } from '../utils/profileValidation';

const LEVEL_OPTIONS = ['Pre-A1 / A1', 'A2', 'B1', 'B2', 'C1', 'IELTS', 'One-to-One', 'Business English', 'Young Learners'];

export function TeamPage() {
  const { user, isAdmin, canInteract, myProfile, teachers, hubConfig, helloFeed } = useHub();

  const [levelFilter, setLevelFilter] = useState('All');
  const [editingMyCard, setEditingMyCard] = useState(false);

  // My Card Edit Form State
  const [eName, setEName] = useState('');
  const [ePhoto, setEPhoto] = useState('');
  const [eLevels, setELevels] = useState<string[]>([]);
  const [eClasses, setEClasses] = useState('');
  const [eLanguages, setELanguages] = useState('');
  const [eYears, setEYears] = useState(1);
  const [eGoodAt, setEGoodAt] = useState('');
  const [eWantHelp, setEWantHelp] = useState('');
  const [eFunFact, setEFunFact] = useState('');
  const [eFavActivity, setEFavActivity] = useState('');
  const [editError, setEditError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Say Hello Modal
  const [helloTarget, setHelloTarget] = useState<string | null>(null);
  const [helloText, setHelloText] = useState('');
  const [sendingHello, setSendingHello] = useState(false);
  const [helloToast, setHelloToast] = useState('');

  // Icebreaker
  const [iceAnswer, setIceAnswer] = useState('');
  const [sendingIce, setSendingIce] = useState(false);
  const [editingIceQ, setEditingIceQ] = useState(false);
  const [iceQInput, setIceQInput] = useState('');

  // Admin Spotlight
  const [editingSpotlight, setEditingSpotlight] = useState(false);
  const [spotTeacherUid, setSpotTeacherUid] = useState('');
  const [spotBody, setSpotBody] = useState('');

  const spotlight = hubConfig['spotlight'];
  const icebreaker = hubConfig['icebreaker'];

  const allLevelsInTeam = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => (t.levels || []).forEach((l) => set.add(l)));
    return ['All', ...Array.from(set).sort()];
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    if (levelFilter === 'All') return teachers;
    return teachers.filter((t) => (t.levels || []).includes(levelFilter));
  }, [teachers, levelFilter]);

  const icebreakerAnswers = useMemo(
    () => helloFeed.filter((p) => p.type === 'icebreaker').slice(0, 8),
    [helloFeed]
  );

  const openEditMyCard = () => {
    if (!myProfile) return;
    setEName(myProfile.displayName);
    setEPhoto(myProfile.photoUrl || '');
    setELevels(myProfile.levels || []);
    setEClasses(myProfile.classesTaught || '');
    setELanguages(myProfile.languages || '');
    setEYears(myProfile.yearsTeaching ?? 0);
    setEGoodAt(myProfile.goodAt || '');
    setEWantHelp(myProfile.wantHelpWith || '');
    setEFunFact(myProfile.funFact || '');
    setEFavActivity(myProfile.favouriteActivity || '');
    setEditError('');
    setEditingMyCard(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await compressImageFileToDataUrl(file, 220, 0.78);
      setEPhoto(url);
    } catch (err) {
      console.error(err);
    }
  };

  const editMissingFields = useMemo(
    () =>
      getMissingTeacherProfileFields({
        displayName: eName,
        languages: eLanguages,
        yearsTeaching: eYears,
        levels: eLevels,
        classesTaught: eClasses,
        goodAt: eGoodAt,
        wantHelpWith: eWantHelp,
        funFact: eFunFact,
        favouriteActivity: eFavActivity,
      }),
    [eName, eLanguages, eYears, eLevels, eClasses, eGoodAt, eWantHelp, eFunFact, eFavActivity]
  );

  const handleSaveMyCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !myProfile || !canInteract) return;
    if (!isAdmin && editMissingFields.length > 0) {
      setEditError(`Please fill in all required fields: ${editMissingFields.join(', ')}.`);
      return;
    }
    setEditError('');
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'teachers', user.uid), {
        displayName: eName.trim().slice(0, 120) || myProfile.displayName,
        photoUrl: ePhoto.slice(0, 150000),
        levels: eLevels.slice(0, 10),
        classesTaught: eClasses.trim().slice(0, 200),
        languages: eLanguages.trim().slice(0, 200),
        yearsTeaching: Math.max(0, Math.min(60, Number(eYears) || 0)),
        goodAt: eGoodAt.trim().slice(0, 300),
        wantHelpWith: eWantHelp.trim().slice(0, 300),
        funFact: eFunFact.trim().slice(0, 300),
        favouriteActivity: eFavActivity.trim().slice(0, 300),
        onboardingComplete: true,
        checklist: { ...myProfile.checklist, profileDone: true },
        updatedAt: serverTimestamp(),
      });
      setEditingMyCard(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teachers/${user.uid}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendHello = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin || !helloTarget || !helloText.trim()) return;
    setSendingHello(true);
    try {
      await addDoc(collection(db, 'helloFeed'), {
        authorUid: user.uid,
        authorName: (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120),
        type: 'hello',
        targetName: helloTarget.slice(0, 120),
        message: helloText.trim().slice(0, 400),
        isSample: false,
        createdAt: serverTimestamp(),
      });
      setHelloToast(`Your friendly hello to ${helloTarget} was posted on Home!`);
      setHelloTarget(null);
      setHelloText('');
      setTimeout(() => setHelloToast(''), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'helloFeed');
    } finally {
      setSendingHello(false);
    }
  };

  const handlePostIcebreaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin || !iceAnswer.trim()) return;
    setSendingIce(true);
    try {
      await addDoc(collection(db, 'helloFeed'), {
        authorUid: user.uid,
        authorName: (myProfile?.displayName || user.displayName || 'Teacher').slice(0, 120),
        type: 'icebreaker',
        targetName: '',
        message: iceAnswer.trim().slice(0, 400),
        isSample: false,
        createdAt: serverTimestamp(),
      });
      setIceAnswer('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'helloFeed');
    } finally {
      setSendingIce(false);
    }
  };

  const handleSaveIceQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iceQInput.trim()) return;
    try {
      await setDoc(doc(db, 'hubConfig', 'icebreaker'), {
        kind: 'icebreaker',
        title: 'Icebreaker of the Week',
        body: iceQInput.trim().slice(0, 1200),
        updatedBy: myProfile?.displayName || 'Tr Hein Tay Za',
        updatedAt: serverTimestamp(),
      });
      setEditingIceQ(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'hubConfig/icebreaker');
    }
  };

  const handleSaveSpotlight = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = teachers.find((t) => t.uid === spotTeacherUid);
    try {
      await setDoc(doc(db, 'hubConfig', 'spotlight'), {
        kind: 'spotlight',
        title: 'Teacher of the Week Spotlight',
        body: spotBody.trim().slice(0, 1200),
        teacherUid: chosen?.uid || '',
        teacherName: chosen?.displayName || '',
        updatedBy: myProfile?.displayName || 'Tr Hein Tay Za',
        updatedAt: serverTimestamp(),
      });
      setEditingSpotlight(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'hubConfig/spotlight');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meet the YAO Teaching Team"
        inShort={PAGE_SUMMARIES.team}
        action={
          myProfile && (
            <button
              type="button"
              onClick={openEditMyCard}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Edit3 className="w-4 h-4" />
              Edit my card
            </button>
          )
        }
      />

      {helloToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-800 dark:text-emerald-200 font-medium">
          {helloToast}
        </div>
      )}

      {/* Top Row: Spotlight + Icebreaker of the Week */}
      <div className="grid lg:grid-cols-12 gap-5">
        {/* Teacher of the Week Spotlight */}
        <section className="lg:col-span-5 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
              <Sparkles className="w-4 h-4" />
              <span>Teacher of the Week Spotlight</span>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setSpotTeacherUid(spotlight?.teacherUid || teachers[0]?.uid || '');
                  setSpotBody(spotlight?.body || '');
                  setEditingSpotlight((v) => !v);
                }}
                className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
              >
                {editingSpotlight ? 'Cancel' : 'Set spotlight'}
              </button>
            )}
          </div>

          {editingSpotlight && isAdmin ? (
            <form onSubmit={handleSaveSpotlight} className="space-y-3">
              <select
                value={spotTeacherUid}
                onChange={(e) => setSpotTeacherUid(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              >
                <option value="">Select a teacher...</option>
                {teachers.map((t) => (
                  <option key={t.uid} value={t.uid}>
                    {t.displayName}
                  </option>
                ))}
              </select>
              <textarea
                rows={3}
                required
                maxLength={1200}
                value={spotBody}
                onChange={(e) => setSpotBody(e.target.value)}
                placeholder="Share a quick shout-out about a lesson idea or supportive moment..."
                className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
              >
                Save spotlight
              </button>
            </form>
          ) : spotlight?.body ? (
            <div className="space-y-1.5">
              {spotlight.teacherName && (
                <h2 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                  {spotlight.teacherName}
                </h2>
              )}
              <p className="text-sm text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
                {spotlight.body}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              No teacher spotlight set yet this week.
            </p>
          )}
        </section>

        {/* Weekly Icebreaker */}
        <section className="lg:col-span-7 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
              <MessageCircle className="w-4 h-4" />
              <span>Optional Icebreaker of the Week</span>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIceQInput(icebreaker?.body || '');
                  setEditingIceQ((v) => !v);
                }}
                className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0] hover:underline"
              >
                {editingIceQ ? 'Cancel' : 'Change question'}
              </button>
            )}
          </div>

          {editingIceQ && isAdmin ? (
            <form onSubmit={handleSaveIceQuestion} className="flex gap-2">
              <input
                type="text"
                required
                maxLength={1200}
                value={iceQInput}
                onChange={(e) => setIceQInput(e.target.value)}
                placeholder="Write a fun one-line question for the team..."
                className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
              >
                Save
              </button>
            </form>
          ) : (
            <p className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              {icebreaker?.body || 'What is one small thing that makes you smile after a busy day of teaching?'}
            </p>
          )}

          {isAdmin && (
            <form onSubmit={handlePostIcebreaker} className="flex gap-2">
              <input
                type="text"
                maxLength={400}
                value={iceAnswer}
                onChange={(e) => setIceAnswer(e.target.value)}
                placeholder="Answer in one friendly line..."
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              <button
                type="submit"
                disabled={sendingIce || !iceAnswer.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Post
              </button>
            </form>
          )}

          {icebreakerAnswers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E5D9EC] dark:border-[#332442]">
              {icebreakerAnswers.map((ans) => (
                <p key={ans.id} className="text-xs sm:text-sm text-[#3A2847] dark:text-[#DFD0EC]">
                  <span className="font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
                    {ans.authorName}:{' '}
                  </span>
                  {ans.message}
                </p>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9] mr-1">
          Filter by level:
        </span>
        {allLevelsInTeam.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setLevelFilter(lvl)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              levelFilter === lvl
                ? 'bg-[#3B1050] text-white'
                : 'bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[#3B1050] dark:text-[#E8D5F5]'
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* Directory Grid */}
      {filteredTeachers.length === 0 ? (
        <div className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-10 text-center space-y-2">
          <Users className="w-8 h-8 text-[#BBAAC9] mx-auto" />
          <p className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
            No teachers match this level yet
          </p>
          <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
            As teammates sign in and finish their 2-minute welcome card, they will appear right here.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeachers.map((teacher) => {
            const isMe = teacher.uid === user?.uid;
            return (
              <article
                key={teacher.uid}
                className="bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-5 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-3.5">
                    {teacher.photoUrl ? (
                      <img
                        src={teacher.photoUrl}
                        alt={teacher.displayName}
                        className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-[#E5D9EC] dark:border-[#332442]"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[#3B1050] text-white text-base font-bold flex items-center justify-center shrink-0">
                        {getInitials(teacher.displayName)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9] truncate">
                        {teacher.displayName}
                      </h3>
                      <p className="text-xs text-[#A8567F] dark:text-[#D98EB3] font-medium mt-0.5">
                        {(teacher.levels || []).join(' · ') || 'Levels TBC'}
                      </p>
                      <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5 tabular-nums">
                        {teacher.yearsTeaching} yr{teacher.yearsTeaching === 1 ? '' : 's'} teaching
                        {teacher.languages ? ` · ${teacher.languages}` : ''}
                      </p>
                    </div>
                  </div>

                  {teacher.classesTaught && (
                    <p className="text-xs text-[#5A4A66] dark:text-[#C5B4D4]">
                      <span className="font-semibold text-[#1F122B] dark:text-[#F5EEF9]">Classes: </span>
                      {teacher.classesTaught}
                    </p>
                  )}

                  <dl className="space-y-2.5 text-sm border-t border-[#F0E6F5] dark:border-[#2E203D] pt-3">
                    {teacher.goodAt && (
                      <div>
                        <dt className="text-xs font-semibold text-[#3B1050] dark:text-[#E2B8D0]">
                          I am good at
                        </dt>
                        <dd className="text-[#3A2847] dark:text-[#DFD0EC] mt-0.5">
                          {teacher.goodAt}
                        </dd>
                      </div>
                    )}
                    {teacher.wantHelpWith && (
                      <div>
                        <dt className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
                          I would like help with
                        </dt>
                        <dd className="text-[#3A2847] dark:text-[#DFD0EC] mt-0.5">
                          {teacher.wantHelpWith}
                        </dd>
                      </div>
                    )}
                    {teacher.favouriteActivity && (
                      <div>
                        <dt className="text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9]">
                          Favourite classroom activity
                        </dt>
                        <dd className="text-[#3A2847] dark:text-[#DFD0EC] mt-0.5">
                          {teacher.favouriteActivity}
                        </dd>
                      </div>
                    )}
                    {teacher.funFact && (
                      <div>
                        <dt className="text-xs font-semibold text-[#5A4A66] dark:text-[#BBAAC9]">
                          Fun fact
                        </dt>
                        <dd className="text-[#3A2847] dark:text-[#DFD0EC] mt-0.5">
                          {teacher.funFact}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="pt-3 border-t border-[#F0E6F5] dark:border-[#2E203D] flex items-center justify-between gap-2">
                  {isMe && canInteract ? (
                    <button
                      type="button"
                      onClick={openEditMyCard}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5] text-xs font-semibold hover:bg-[#E8DCF0] transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit my card
                    </button>
                  ) : isAdmin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHelloTarget(teacher.displayName);
                        setHelloText(`Hello ${teacher.displayName}! Excited to teach together at YAO.`);
                      }}
                      className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5] text-xs font-semibold hover:bg-[#3B1050] hover:text-white transition-colors"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      Say hello
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Say Hello Modal */}
      {helloTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setHelloTarget(null)}
        >
          <form
            onSubmit={handleSendHello}
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                Say hello to {helloTarget}
              </h3>
              <button
                type="button"
                onClick={() => setHelloTarget(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
              This posts a short, friendly greeting on the Home feed for everyone to see.
            </p>
            <textarea
              rows={3}
              required
              maxLength={400}
              value={helloText}
              onChange={(e) => setHelloText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHelloTarget(null)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingHello}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
              >
                {sendingHello ? 'Posting...' : 'Post hello on Home'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit My Card Modal */}
      {editingMyCard && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingMyCard(false)}
        >
          <form
            onSubmit={handleSaveMyCard}
            onClick={(e) => e.stopPropagation()}
            className="max-w-xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-[#E5D9EC] dark:border-[#332442] pb-3">
              <h3 className="text-lg font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                Edit My Team Card
              </h3>
              <button
                type="button"
                onClick={() => setEditingMyCard(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {ePhoto ? (
                <img
                  src={ePhoto}
                  alt={eName}
                  className="w-16 h-16 rounded-2xl object-cover border border-[#E5D9EC]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[#3B1050] text-white font-bold flex items-center justify-center">
                  {getInitials(eName)}
                </div>
              )}
              <label className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold cursor-pointer">
                <Camera className="w-4 h-4 text-[#A8567F]" />
                Change photo
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Display name *</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Years of teaching</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={eYears}
                  onChange={(e) => setEYears(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">Levels taught</label>
              <div className="flex flex-wrap gap-1.5">
                {LEVEL_OPTIONS.map((lvl) => {
                  const active = eLevels.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() =>
                        setELevels((prev) =>
                          prev.includes(lvl) ? prev.filter((x) => x !== lvl) : [...prev, lvl]
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        active
                          ? 'bg-[#3B1050] text-white'
                          : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#3B1050] dark:text-[#E8D5F5]'
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Classes taught</label>
                <input
                  type="text"
                  maxLength={200}
                  value={eClasses}
                  onChange={(e) => setEClasses(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Languages</label>
                <input
                  type="text"
                  maxLength={200}
                  value={eLanguages}
                  onChange={(e) => setELanguages(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">I am good at</label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={eGoodAt}
                  onChange={(e) => setEGoodAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">I would like help with</label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={eWantHelp}
                  onChange={(e) => setEWantHelp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Fun fact</label>
                <input
                  type="text"
                  maxLength={300}
                  value={eFunFact}
                  onChange={(e) => setEFunFact(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Favourite classroom activity</label>
                <input
                  type="text"
                  maxLength={300}
                  value={eFavActivity}
                  onChange={(e) => setEFavActivity(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                />
              </div>
            </div>

            {editError && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">{editError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMyCard(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile || (!isAdmin && editMissingFields.length > 0)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {savingProfile ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
