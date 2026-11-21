import type { TeacherProfile } from '../types';

/**
 * Checks that a text answer has at least `minLength` trimmed characters
 * and at least 2 real letter characters (English or Myanmar/Burmese),
 * preventing single-character or number-only placeholders like "1" or "...".
 */
export function hasMeaningfulText(value: string | undefined | null, minLength: number): boolean {
  const trimmed = (value || '').trim();
  if (trimmed.length < minLength) return false;
  const letters = trimmed.match(/[A-Za-z\u1000-\u109F]/g) || [];
  return letters.length >= 2;
}

export interface TeacherProfileFieldsInput {
  displayName: string;
  languages: string;
  yearsTeaching: string | number;
  levels: string[];
  classesTaught: string;
  goodAt: string;
  wantHelpWith: string;
  funFact: string;
  favouriteActivity: string;
}

export function getMissingTeacherProfileFields(input: TeacherProfileFieldsInput): string[] {
  const missing: string[] = [];

  if (!hasMeaningfulText(input.displayName, 2)) {
    missing.push('Your name');
  }
  if (!hasMeaningfulText(input.languages, 2)) {
    missing.push('Languages spoken');
  }
  const yearsStr = String(input.yearsTeaching ?? '').trim();
  const yearsNum = Number(yearsStr);
  if (yearsStr === '' || Number.isNaN(yearsNum) || yearsNum < 0 || yearsNum > 60) {
    missing.push('Years of teaching');
  }
  if (!Array.isArray(input.levels) || input.levels.length === 0) {
    missing.push('Levels you teach at YAO');
  }
  if (!hasMeaningfulText(input.classesTaught, 3)) {
    missing.push('Classes / groups you teach');
  }
  if (!hasMeaningfulText(input.goodAt, 5)) {
    missing.push('I am good at (at least 5 characters)');
  }
  if (!hasMeaningfulText(input.wantHelpWith, 5)) {
    missing.push('I would like help with (at least 5 characters)');
  }
  if (!hasMeaningfulText(input.funFact, 5)) {
    missing.push('Fun fact about me (at least 5 characters)');
  }
  if (!hasMeaningfulText(input.favouriteActivity, 5)) {
    missing.push('Favourite classroom activity (at least 5 characters)');
  }

  return missing;
}

export function isTeacherProfileComplete(profile: TeacherProfile | null): boolean {
  if (!profile || !profile.onboardingComplete) return false;
  const missing = getMissingTeacherProfileFields({
    displayName: profile.displayName || '',
    languages: profile.languages || '',
    yearsTeaching: profile.yearsTeaching ?? '',
    levels: profile.levels || [],
    classesTaught: profile.classesTaught || '',
    goodAt: profile.goodAt || '',
    wantHelpWith: profile.wantHelpWith || '',
    funFact: profile.funFact || '',
    favouriteActivity: profile.favouriteActivity || '',
  });
  return missing.length === 0;
}
