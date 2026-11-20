const SOUND_PREF_KEY = 'yao_notif_sound_enabled';

let sharedAudioCtx: AudioContext | null = null;
let unlockBound = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

/**
 * Unlocks Web Audio on the user's first click/keypress so live incoming
 * Firestore notifications can chime reliably without browser autoplay blocks.
 */
export function ensureNotificationAudioUnlocked(): void {
  if (typeof window === 'undefined' || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

export function isNotificationSoundEnabled(): boolean {
  try {
    const val = window.localStorage.getItem(SOUND_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage errors
  }
}

/**
 * Plays a pleasant, crisp notification bell chime synthesized via Web Audio API.
 * Important alerts play a bright 3-note chime; standard notifications play a 2-note chime.
 */
export function playNotificationChime(important = true): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const triggerNotes = () => {
    const now = ctx.currentTime;
    const notes = important ? [783.99, 1046.5, 1318.51] : [659.25, 987.77]; // G5-C6-E6 or E5-B5

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.4);
    });
  };

  if (ctx.state === 'suspended') {
    ctx.resume().then(triggerNotes).catch(() => {});
  } else {
    triggerNotes();
  }
}
