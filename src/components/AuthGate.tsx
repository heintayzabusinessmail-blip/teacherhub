import React, { useState } from 'react';
import { LogOut, Moon, ShieldAlert, Sun } from 'lucide-react';
import { BRAND } from '../content/planContent';
import { signInWithGooglePopup, signOutUser } from '../firebase';
import { useHub } from '../context/HubContext';

export function AuthGate() {
  const { user, isAllowed, darkMode, toggleDarkMode } = useHub();

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setBusy(true);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in could not finish.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('Sign-in popup was closed. Please try again.');
      } else if (msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setErrorMsg(
          `This website domain (${host}) is not authorized in Firebase yet. In Firebase Console → Authentication → Settings → Authorized domains, click "Add domain" and add: ${host}`
        );
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  // Fallback guard if access is explicitly revoked
  if (user && !isAllowed) {
    return (
      <div className="min-h-screen bg-[#F4EEF7] dark:bg-[#140D1A] flex flex-col justify-between p-4 sm:p-8">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[#3B1050] dark:text-[#E8D5F5]"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <main className="max-w-md w-full mx-auto bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm space-y-6 text-center">
          <div className="inline-flex bg-white p-2.5 rounded-xl border border-[#E5D9EC]">
            <img
              src={BRAND.logoPath}
              alt="YAO English logo"
              className="h-12 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F4EEF7] dark:bg-[#2C1E38] text-[#A8567F] mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              Access unavailable
            </h1>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed">
              Your signed-in account{' '}
              <span className="font-semibold text-[#1F122B] dark:text-white">{user.email}</span>{' '}
              could not be opened right now.
            </p>
          </div>

          <button
            type="button"
            onClick={() => signOutUser()}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out and try another account
          </button>
        </main>

        <footer className="text-center text-xs text-[#5A4A66] dark:text-[#BBAAC9] py-4">
          {BRAND.footerText}
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4EEF7] dark:bg-[#140D1A] flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-[#A8567F] dark:text-[#D98EB3]">
          {BRAND.draftBadge} · YAO English Teacher Hub
        </span>
        <button
          type="button"
          onClick={toggleDarkMode}
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[#3B1050] dark:text-[#E8D5F5]"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <main className="max-w-5xl w-full mx-auto my-8 grid lg:grid-cols-12 gap-8 items-stretch">
        {/* Left welcome card */}
        <section className="lg:col-span-7 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-10 shadow-sm flex flex-col justify-center">
          <div className="space-y-5">
            <div className="inline-flex bg-white p-2.5 rounded-xl border border-[#E5D9EC]">
              <img
                src={BRAND.logoPath}
                alt="YAO English logo"
                className="h-14 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1F122B] dark:text-[#F5EEF9]">
                {BRAND.appName}
              </h1>
              <p className="text-base sm:text-lg text-[#A8567F] dark:text-[#D98EB3] font-medium">
                {BRAND.subtitle}
              </p>
            </div>
            <p className="text-base text-[#5A4A66] dark:text-[#C5B4D4] leading-relaxed">
              Welcome! This hub shows clearly how Tr Hein will support YAO English teachers
              from Month 1 to Month 6, helps our team get to know each other, and keeps all digital
              coursebooks, slides, training, and feedback in one simple place.
            </p>
          </div>
        </section>

        {/* Right sign-in panel */}
        <section className="lg:col-span-5 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm flex flex-col justify-center space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">Sign In</h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              Sign in with any Google account to view the hub.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-800 dark:text-red-200"
            >
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#FFFFFF"
                  d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.47-1.7 4.32-5.27 4.32-3.17 0-5.76-2.63-5.76-5.88s2.59-5.88 5.76-5.88c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.79 4.1 14.69 3.1 12.17 3.1 7.21 3.1 3.2 7.11 3.2 12.06s4.01 8.96 8.97 8.96c5.18 0 8.61-3.64 8.61-8.77 0-.59-.06-1.03-.14-1.15z"
                />
              </svg>
              {busy ? 'Opening Google...' : 'Sign in with Google'}
            </button>

            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed">
              Anyone signing in with Gmail gets view-only access. Teachers added by Tr Hein can
              complete their profile and submit surveys and forms; only Tr Hein can edit hub
              content.
            </p>
          </div>
        </section>
      </main>

      <footer className="max-w-5xl w-full mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 py-4 text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
        <div className="bg-white px-2 py-1 rounded-lg border border-[#E5D9EC]">
          <img
            src={BRAND.logoPath}
            alt="YAO English logo"
            className="h-6 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <span>{BRAND.footerText}</span>
      </footer>
    </div>
  );
}
