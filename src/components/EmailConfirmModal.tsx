import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Mail, X } from 'lucide-react';

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
}

/**
 * Lightweight zero-API modal that lets the user optionally open their default
 * email app (Gmail, Apple Mail, Outlook) with recipients, subject, and body
 * pre-filled — no OAuth popups or Google verification required.
 */
export function EmailConfirmModal({ draft, onClose }: EmailConfirmModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [draft]);

  if (!draft) return null;

  const mailtoHref = `mailto:${encodeURIComponent(draft.recipients.join(','))}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.bodyText)}`;

  const handleCopy = () => {
    const fullText = `To: ${draft.recipients.join(', ')}\nSubject: ${draft.subject}\n\n${draft.bodyText}`;
    navigator.clipboard?.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
                Live alert is already posted on the Hub · Optional email copy below
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-[#5A4A66] hover:bg-[#F4EEF7] dark:hover:bg-[#2A1D38]"
            aria-label="Close email dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-[#FAF7FC] dark:bg-[#160F1F] border border-[#E5D9EC] dark:border-[#332442] p-3.5 space-y-2 text-xs">
            <div>
              <span className="font-semibold text-[#5A4A66] dark:text-[#BBAAC9]">
                To ({draft.recipients.length} email{draft.recipients.length === 1 ? '' : 's'}):
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
                Message:
              </span>
              <p className="text-[#1F122B] dark:text-[#DFD0EC] whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                {draft.bodyText}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium text-[#5A4A66] dark:text-[#C5B4D4]"
            >
              Done (Hub alert only)
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5] hover:border-[#A8567F]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy text'}
            </button>
            {draft.recipients.length > 0 && (
              <a
                href={mailtoHref}
                onClick={onClose}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3B1050] hover:bg-[#4E1869] text-white text-xs font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Email App
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
