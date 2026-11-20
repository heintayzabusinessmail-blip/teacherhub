import React, { useEffect, useState } from 'react';
import { CheckCircle2, Mail, Send, X } from 'lucide-react';
import { auth, connectGmailPopup, getGmailAccessToken } from '../firebase';
import { sendNotificationEmailsViaGmail } from '../utils/gmailSender';

export interface PendingEmailDraft {
  heading: string;
  recipients: string[];
  subject: string;
  bodyText: string;
  senderLabel?: string;
}

interface EmailConfirmModalProps {
  draft: PendingEmailDraft | null;
  onClose: () => void;
  onSent?: (sentCount: number) => void;
}

/**
 * Explicit user confirmation dialog required before sending any email through
 * the user's connected Gmail account. Lists exact recipients, subject, and body,
 * and allows connecting Gmail in one click if the in-memory session token expired.
 */
export function EmailConfirmModal({ draft, onClose, onSent }: EmailConfirmModalProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentDone, setSentDone] = useState<number | null>(null);

  useEffect(() => {
    setSending(false);
    setError('');
    setSentDone(null);
  }, [draft]);

  if (!draft) return null;

  const hasToken = Boolean(getGmailAccessToken());
  const senderEmail = auth.currentUser?.email || '';

  const handleConfirmAndSend = async () => {
    setError('');
    setSending(true);
    try {
      let token = getGmailAccessToken();
      if (!token) {
        token = await connectGmailPopup();
      }
      if (!token) {
        setError('Gmail permission was not granted. You can try again or close this dialog.');
        setSending(false);
        return;
      }

      const result = await sendNotificationEmailsViaGmail(
        {
          to: draft.recipients,
          subject: draft.subject,
          bodyText: draft.bodyText,
          senderLabel: draft.senderLabel,
        },
        token
      );

      if (result.authExpired) {
        setError(result.errorMessage || 'Please reconnect Gmail and try again.');
      } else if (result.failedRecipients.length > 0) {
        setError(result.errorMessage || 'Some emails could not be sent.');
        if (result.sentCount > 0) {
          setSentDone(result.sentCount);
          onSent?.(result.sentCount);
        }
      } else {
        setSentDone(result.sentCount);
        onSent?.(result.sentCount);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not connect Gmail right now.';
      if (msg.includes('popup-closed-by-user')) {
        setError('Google sign-in popup was closed before completing Gmail permission.');
      } else if (msg.includes('popup-blocked')) {
        setError('Your browser blocked the Google permission popup. Please allow popups and try again.');
      } else {
        setError('Could not connect Gmail right now. Please try again and tick the Gmail permission box.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-lg w-full bg-white dark:bg-[#1F1629] rounded-2xl border border-[#E5D9EC] dark:border-[#332442] shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E5D9EC] dark:border-[#332442] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#A8567F] flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                {draft.heading}
              </h3>
              <p className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                {senderEmail
                  ? `Sending from ${senderEmail} via Gmail`
                  : 'Confirm before sending via your Gmail account'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-[#5A4A66] hover:bg-[#F4EEF7] dark:hover:bg-[#2A1D38]"
            aria-label="Close email confirmation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {sentDone !== null && !error ? (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Email notification sent!
                </p>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  Delivered to {sentDone} registered email address{sentDone > 1 ? 'es' : ''}.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-3.5 space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-[#5A4A66] dark:text-[#BBAAC9]">
                    To ({draft.recipients.length} registered email
                    {draft.recipients.length === 1 ? '' : 's'}):
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {draft.recipients.map((email) => (
                      <span
                        key={email}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] text-[11px] font-medium text-[#3B1050] dark:text-[#E8D5F5]"
                      >
                        {email}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-1 border-t border-[#E5D9EC] dark:border-[#332442]">
                  <span className="font-semibold text-[#5A4A66] dark:text-[#BBAAC9]">Subject: </span>
                  <span className="font-semibold text-[#1F122B] dark:text-[#F5EEF9]">
                    {draft.subject}
                  </span>
                </div>

                <div className="pt-1 border-t border-[#E5D9EC] dark:border-[#332442]">
                  <span className="font-semibold text-[#5A4A66] dark:text-[#BBAAC9] block mb-1">
                    Message preview:
                  </span>
                  <p className="text-[#1F122B] dark:text-[#DFD0EC] whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                    {draft.bodyText}
                  </p>
                </div>
              </div>

              {!hasToken && (
                <p className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9] leading-relaxed">
                  Clicking below will open Google once to confirm permission to send this email from
                  your Gmail account.
                </p>
              )}

              {error && (
                <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-3 rounded-xl">
                  {error}
                </p>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {sentDone !== null && !error ? (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-[#3B1050] text-white text-xs font-semibold"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium text-[#5A4A66] dark:text-[#C5B4D4]"
                >
                  Skip email
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndSend}
                  disabled={sending || draft.recipients.length === 0}
                  className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {hasToken ? <Send className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  {sending
                    ? 'Sending email...'
                    : hasToken
                      ? `Confirm & Send (${draft.recipients.length})`
                      : 'Connect Gmail & Send'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
