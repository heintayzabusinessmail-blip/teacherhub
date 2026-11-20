import React, { useState } from 'react';
import { LogOut, Mail, Moon, ShieldAlert, Sun, CheckCircle2 } from 'lucide-react';
import { BRAND } from '../content/planContent';
import {
  completeEmailLinkWithAddress,
  sendEmailSignInLink,
  signInWithGooglePopup,
  signOutUser,
} from '../firebase';
import { useHub } from '../context/HubContext';

export function AuthGate() {
  const {
    user,
    isAllowed,
    needsEmailLinkConfirm,
    setNeedsEmailLinkConfirm,
    darkMode,
    toggleDarkMode,
  } = useHub();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
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
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setErrorMsg('');
    setBusy(true);
    try {
      await sendEmailSignInLink(emailInput);
      setEmailSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send sign-in link.';
      setErrorMsg(
        msg.includes('operation-not-allowed')
          ? 'Email link sign-in is not turned on yet in Firebase Console. Please use Sign in with Google, or ask Tr Hein to enable Email Link in Authentication > Sign-in method.'
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteEmailConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setErrorMsg('');
    setBusy(true);
    try {
      await completeEmailLinkWithAddress(emailInput);
      setNeedsEmailLinkConfirm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not complete sign-in link.');
    } finally {
      setBusy(false);
    }
  };

  // Case 1: Signed in, but email is NOT on Tr Hein's allowlist
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
              Ask Tr Hein to add your email.
            </h1>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed">
              This is a private space for YAO English teachers. Your signed-in email{' '}
              <span className="font-semibold text-[#1F122B] dark:text-white">{user.email}</span> is
              not on the allowlist yet.
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

  // Case 2: Signed out (or confirming Email Link address)
  return (
    <div className="min-h-screen bg-[#F4EEF7] dark:bg-[#140D1A] flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-[#A8567F] dark:text-[#D98EB3]">
          {BRAND.draftBadge} · Private YAO Teachers Space
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
        <section className="lg:col-span-7 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-10 shadow-sm flex flex-col justify-between space-y-8">
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
              Welcome! This private hub shows clearly how Tr Hein will support YAO English teachers
              from Month 1 to Month 6, helps our team get to know each other, and keeps all digital
              coursebooks, slides, training, and feedback in one simple place.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-6 border-t border-[#E5D9EC] dark:border-[#332442] text-sm">
            <div>
              <p className="font-semibold text-[#3B1050] dark:text-[#E8D5F5]">Clear plan</p>
              <p className="text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5">
                Every page starts with a one-sentence “In short” summary.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#3B1050] dark:text-[#E8D5F5]">Private & safe</p>
              <p className="text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5">
                Observation notes are visible only to you, Tr Hein, and the Founder.
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#3B1050] dark:text-[#E8D5F5]">Draft for discussion</p>
              <p className="text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5">
                Built so every teacher can shape Month 1 and Months 2–6 together.
              </p>
            </div>
          </div>
        </section>

        {/* Right sign-in panel */}
        <section className="lg:col-span-5 bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] p-6 sm:p-8 shadow-sm flex flex-col justify-center space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-[#1F122B] dark:text-[#F5EEF9]">
              {needsEmailLinkConfirm ? 'Confirm your email' : 'Teacher Sign In'}
            </h2>
            <p className="text-sm text-[#5A4A66] dark:text-[#BBAAC9]">
              {needsEmailLinkConfirm
                ? 'Please re-enter the email address you used to request your sign-in link.'
                : 'Sign in with your approved Google account or a passwordless email link.'}
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

          {needsEmailLinkConfirm ? (
            <form onSubmit={handleCompleteEmailConfirm} className="space-y-4">
              <div>
                <label
                  htmlFor="confirm-email"
                  className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1.5"
                >
                  Your email address
                </label>
                <input
                  id="confirm-email"
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="teacher@example.com"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm text-[#1F122B] dark:text-[#F5EEF9] focus:outline-none focus:ring-2 focus:ring-[#A8567F]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {busy ? 'Finishing sign in...' : 'Complete sign in'}
              </button>
            </form>
          ) : (
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

              <div className="relative py-2 flex items-center">
                <div className="flex-grow border-t border-[#E5D9EC] dark:border-[#332442]" />
                <span className="px-3 text-xs text-[#5A4A66] dark:text-[#BBAAC9]">or</span>
                <div className="flex-grow border-t border-[#E5D9EC] dark:border-[#332442]" />
              </div>

              {!showEmailForm ? (
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-sm font-medium text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#F4EEF7] dark:hover:bg-[#2C1E38] transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Sign in with Email Link (no password)
                </button>
              ) : emailSent ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-2 text-sm text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Sign-in link sent!
                  </div>
                  <p>
                    Check <span className="font-semibold">{emailInput}</span> and click the link to
                    open the YAO Teacher Hub.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSendEmailLink} className="space-y-3">
                  <div>
                    <label
                      htmlFor="email-link-input"
                      className="block text-sm font-medium text-[#1F122B] dark:text-[#F5EEF9] mb-1"
                    >
                      Teacher email
                    </label>
                    <input
                      id="email-link-input"
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="your.name@gmail.com"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-[#FAF7FC] dark:bg-[#140D1A] text-sm text-[#1F122B] dark:text-[#F5EEF9] focus:outline-none focus:ring-2 focus:ring-[#A8567F]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#A8567F] hover:bg-[#91446A] text-white text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {busy ? 'Sending link...' : 'Send passwordless sign-in link'}
                  </button>
                </form>
              )}

              <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed">
                We never ask for or store passwords. Only allowlisted YAO English emails can enter.
                Not added yet? Ask Tr Hein to add your email.
              </p>
            </div>
          )}
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
