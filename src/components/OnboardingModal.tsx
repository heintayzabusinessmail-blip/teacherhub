import React, { useMemo, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, LogOut, UserCheck } from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, signOutUser } from '../firebase';
import { useHub } from '../context/HubContext';
import { compressImageFileToDataUrl, getInitials } from '../utils/helpers';
import { getMissingTeacherProfileFields, hasMeaningfulText } from '../utils/profileValidation';
import { BRAND } from '../content/planContent';

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

export function OnboardingModal() {
  const { user, myProfile } = useHub();

  const [displayName, setDisplayName] = useState(
    myProfile?.displayName || user?.displayName || ''
  );
  const [photoUrl, setPhotoUrl] = useState(myProfile?.photoUrl || user?.photoURL || '');
  const [levels, setLevels] = useState<string[]>(myProfile?.levels || []);
  const [classesTaught, setClassesTaught] = useState(myProfile?.classesTaught || '');
  const [languages, setLanguages] = useState(myProfile?.languages || 'Burmese, English');
  const [yearsTeaching, setYearsTeaching] = useState<string>(
    myProfile?.yearsTeaching !== undefined ? String(myProfile.yearsTeaching) : ''
  );
  const [goodAt, setGoodAt] = useState(myProfile?.goodAt || '');
  const [wantHelpWith, setWantHelpWith] = useState(myProfile?.wantHelpWith || '');
  const [funFact, setFunFact] = useState(myProfile?.funFact || '');
  const [favouriteActivity, setFavouriteActivity] = useState(myProfile?.favouriteActivity || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const missingFields = useMemo(
    () =>
      getMissingTeacherProfileFields({
        displayName,
        languages,
        yearsTeaching,
        levels,
        classesTaught,
        goodAt,
        wantHelpWith,
        funFact,
        favouriteActivity,
      }),
    [
      displayName,
      languages,
      yearsTeaching,
      levels,
      classesTaught,
      goodAt,
      wantHelpWith,
      funFact,
      favouriteActivity,
    ]
  );

  const isFormComplete = missingFields.length === 0;

  if (!user) return null;

  const toggleLevel = (lvl: string) => {
    setLevels((prev) =>
      prev.includes(lvl)
        ? prev.filter((item) => item !== lvl)
        : prev.length < 10
          ? [...prev, lvl]
          : prev
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 220, 0.78);
      setPhotoUrl(dataUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not process image.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormComplete) {
      setErrorMsg(
        `Please complete all required information before joining: ${missingFields.join(', ')}.`
      );
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const cleanYears = Math.max(0, Math.min(60, Number(yearsTeaching) || 0));
      const payload = {
        displayName: displayName.trim().slice(0, 120),
        photoUrl: (photoUrl || '').slice(0, 150000),
        levels: levels.slice(0, 10),
        classesTaught: classesTaught.trim().slice(0, 200),
        languages: languages.trim().slice(0, 200),
        yearsTeaching: cleanYears,
        goodAt: goodAt.trim().slice(0, 300),
        wantHelpWith: wantHelpWith.trim().slice(0, 300),
        funFact: funFact.trim().slice(0, 300),
        favouriteActivity: favouriteActivity.trim().slice(0, 300),
        onboardingComplete: true,
        checklist: {
          profileDone: true,
          surveyDone: myProfile?.checklist?.surveyDone ?? false,
          oneToOneBooked: myProfile?.checklist?.oneToOneBooked ?? false,
          observationScheduled: myProfile?.checklist?.observationScheduled ?? false,
          trainingAttended: myProfile?.checklist?.trainingAttended ?? false,
        },
        updatedAt: serverTimestamp(),
      };

      if (myProfile) {
        await updateDoc(doc(db, 'teachers', user.uid), payload);
      } else {
        await setDoc(doc(db, 'teachers', user.uid), {
          uid: user.uid,
          ...payload,
          isSample: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(
        err,
        myProfile ? OperationType.UPDATE : OperationType.CREATE,
        `teachers/${user.uid}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EEF7] dark:bg-[#140D1A] py-8 px-4 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5D9EC] dark:border-[#332442] pb-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#A8567F] dark:text-[#D98EB3]">
              Required Teacher Profile Setup
            </p>
            <h1 className="text-2xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Welcome to the YAO Teacher Hub!
            </h1>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Please complete all required fields below so Tr Hein and teammates know your levels,
              strengths, and support needs before joining the hub.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="bg-white p-1.5 rounded-lg border border-[#E5D9EC]">
              <img
                src={BRAND.logoPath}
                alt="YAO English logo"
                className="h-9 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5A4A66] dark:text-[#BBAAC9] hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="w-3 h-3" />
              Switch account
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-800 dark:text-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Name + photo */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName || 'Teacher photo'}
                  className="w-20 h-20 rounded-2xl object-cover border border-[#E5D9EC] dark:border-[#332442]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#3B1050] text-white flex items-center justify-center text-xl font-bold">
                  {getInitials(displayName || 'T')}
                </div>
              )}
              <label
                htmlFor="onboarding-photo"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#3B1050] dark:text-[#D98EB3] cursor-pointer hover:underline"
              >
                <Camera className="w-3.5 h-3.5" />
                Upload photo (optional)
              </label>
              <input
                id="onboarding-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                  Your name (as you like teammates to call you) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Tr Hein Tay Za or Ms Aye Chan"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm text-[#1F122B] dark:text-[#F5EEF9]"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                    Languages spoken <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={200}
                    value={languages}
                    onChange={(e) => setLanguages(e.target.value)}
                    placeholder="Burmese, English (C1)"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                    Years of teaching <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={60}
                    value={yearsTeaching}
                    onChange={(e) => setYearsTeaching(e.target.value)}
                    placeholder="e.g., 2"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Levels taught */}
          <div>
            <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-2">
              Levels you teach at YAO <span className="text-rose-600">*</span>{' '}
              <span className="text-xs font-normal text-[#5A4A66] dark:text-[#BBAAC9]">
                (select at least one)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map((lvl) => {
                const active = levels.includes(lvl);
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => toggleLevel(lvl)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#3B1050] text-white'
                        : 'bg-[#F4EEF7] dark:bg-[#2C1E38] text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#E8DCF0] dark:hover:bg-[#3A274A]'
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
              Classes / groups you currently teach <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={classesTaught}
              onChange={(e) => setClassesTaught(e.target.value)}
              placeholder="e.g., B1 Evening Group, IELTS Academic / General, One-to-One"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                I am good at... <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                required
                minLength={5}
                maxLength={300}
                value={goodAt}
                onChange={(e) => setGoodAt(e.target.value)}
                placeholder="e.g., Making shy students feel comfortable speaking"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              {goodAt.trim().length > 0 && !hasMeaningfulText(goodAt, 5) && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                  Please write a real short answer (at least 5 characters).
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                I would like help with... <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                required
                minLength={5}
                maxLength={300}
                value={wantHelpWith}
                onChange={(e) => setWantHelpWith(e.target.value)}
                placeholder="e.g., Faster grammar explanations or Zoom timing"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              {wantHelpWith.trim().length > 0 && !hasMeaningfulText(wantHelpWith, 5) && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                  Please write a real short answer (at least 5 characters).
                </p>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                Fun fact about me <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={300}
                value={funFact}
                onChange={(e) => setFunFact(e.target.value)}
                placeholder="e.g., I drink 3 cups of tea a day"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              {funFact.trim().length > 0 && !hasMeaningfulText(funFact, 5) && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                  Please write a real short fun fact (at least 5 characters).
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                Favourite classroom activity <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={300}
                value={favouriteActivity}
                onChange={(e) => setFavouriteActivity(e.target.value)}
                placeholder="e.g., Two Truths and One Lie"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
              {favouriteActivity.trim().length > 0 &&
                !hasMeaningfulText(favouriteActivity, 5) && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                    Please write a real classroom activity (at least 5 characters).
                  </p>
                )}
            </div>
          </div>

          {/* Live Missing Fields Indicator */}
          {!isFormComplete && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  Complete {missingFields.length} remaining required{' '}
                  {missingFields.length === 1 ? 'field' : 'fields'} to unlock Join YAO Teacher Hub:
                </p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  {missingFields.join(' · ')}
                </p>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#A8567F] shrink-0" />
              No phone numbers, personal emails, or pay details are stored here.
            </p>
            <button
              type="submit"
              disabled={saving || !isFormComplete}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4" />
              {saving ? 'Saving profile...' : 'Join YAO Teacher Hub'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
