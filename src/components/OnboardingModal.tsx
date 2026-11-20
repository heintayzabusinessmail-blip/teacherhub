import React, { useState } from 'react';
import { Camera, CheckCircle2, UserCheck } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useHub } from '../context/HubContext';
import { compressImageFileToDataUrl, getInitials } from '../utils/helpers';
import { BRAND } from '../content/planContent';

const LEVEL_OPTIONS = ['Pre-A1 / A1', 'A2', 'B1', 'B2', 'C1', 'One-to-One', 'Business English', 'Young Learners'];

export function OnboardingModal() {
  const { user } = useHub();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoURL || '');
  const [levels, setLevels] = useState<string[]>(['B1']);
  const [classesTaught, setClassesTaught] = useState('');
  const [languages, setLanguages] = useState('Burmese, English');
  const [yearsTeaching, setYearsTeaching] = useState<number>(2);
  const [goodAt, setGoodAt] = useState('');
  const [wantHelpWith, setWantHelpWith] = useState('');
  const [funFact, setFunFact] = useState('');
  const [favouriteActivity, setFavouriteActivity] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!user) return null;

  const toggleLevel = (lvl: string) => {
    setLevels((prev) =>
      prev.includes(lvl) ? prev.filter((item) => item !== lvl) : prev.length < 10 ? [...prev, lvl] : prev
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
    if (!displayName.trim()) {
      setErrorMsg('Please enter your name so teammates recognise you.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const now = serverTimestamp();
      await setDoc(doc(db, 'teachers', user.uid), {
        uid: user.uid,
        displayName: displayName.trim().slice(0, 120),
        photoUrl: (photoUrl || '').slice(0, 150000),
        levels: levels.slice(0, 10),
        classesTaught: classesTaught.trim().slice(0, 200),
        languages: languages.trim().slice(0, 200),
        yearsTeaching: Math.max(0, Math.min(60, Number(yearsTeaching) || 0)),
        goodAt: goodAt.trim().slice(0, 300),
        wantHelpWith: wantHelpWith.trim().slice(0, 300),
        funFact: funFact.trim().slice(0, 300),
        favouriteActivity: favouriteActivity.trim().slice(0, 300),
        onboardingComplete: true,
        checklist: {
          profileDone: true,
          surveyDone: false,
          oneToOneBooked: false,
          observationScheduled: false,
          trainingAttended: false,
        },
        isSample: false,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `teachers/${user.uid}`);
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
              Quick 2-minute welcome setup
            </p>
            <h1 className="text-2xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Welcome to the YAO Teacher Hub!
            </h1>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              In short: Confirm your name and share a quick “Get to know me” card so our team can
              say hello. You can edit this anytime.
            </p>
          </div>
          <div className="bg-white p-1.5 rounded-lg border border-[#E5D9EC] shrink-0">
            <img
              src={BRAND.logoPath}
              alt="YAO English logo"
              className="h-9 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-800 dark:text-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Name + optional photo */}
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
                  Your name (as you like teammates to call you) *
                </label>
                <input
                  type="text"
                  required
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
                    Languages spoken
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={languages}
                    onChange={(e) => setLanguages(e.target.value)}
                    placeholder="Burmese, English (C1)"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                    Years of teaching
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={yearsTeaching}
                    onChange={(e) => setYearsTeaching(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Levels taught */}
          <div>
            <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-2">
              Levels you teach at YAO
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
              Classes / groups you currently teach
            </label>
            <input
              type="text"
              maxLength={200}
              value={classesTaught}
              onChange={(e) => setClassesTaught(e.target.value)}
              placeholder="e.g., B1 Evening Group, B2 Weekend Group, One-to-One"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                I am good at...
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={goodAt}
                onChange={(e) => setGoodAt(e.target.value)}
                placeholder="e.g., Making shy students feel comfortable speaking"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                I would like help with...
              </label>
              <textarea
                rows={2}
                maxLength={300}
                value={wantHelpWith}
                onChange={(e) => setWantHelpWith(e.target.value)}
                placeholder="e.g., Faster grammar explanations or Zoom timing"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                Fun fact about me
              </label>
              <input
                type="text"
                maxLength={300}
                value={funFact}
                onChange={(e) => setFunFact(e.target.value)}
                placeholder="e.g., I drink 3 cups of tea a day"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1">
                Favourite classroom activity
              </label>
              <input
                type="text"
                maxLength={300}
                value={favouriteActivity}
                onChange={(e) => setFavouriteActivity(e.target.value)}
                placeholder="e.g., Two Truths and One Lie"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#A8567F] shrink-0" />
              No phone numbers, personal emails, or pay details are stored here.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              <UserCheck className="w-4 h-4" />
              {saving ? 'Saving profile...' : 'Enter YAO Teacher Hub'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
