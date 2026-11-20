import { clearGmailAccessToken, getGmailAccessToken } from '../firebase';

export interface EmailSendPayload {
  to: string[];
  subject: string;
  bodyText: string;
  senderLabel?: string;
}

export interface EmailSendResult {
  sentCount: number;
  failedRecipients: string[];
  authExpired?: boolean;
  errorMessage?: string;
}

function toBase64Url(utf8Str: string): string {
  const bytes = new TextEncoder().encode(utf8Str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeader(value: string): string {
  // Encode UTF-8 subject cleanly so emojis and dashes display properly in Gmail
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br />');
}

function buildMimeMessage(to: string, subject: string, bodyText: string, senderLabel?: string): string {
  const hubUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const htmlBody = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; color: #1F122B; max-width: 580px; margin: 0 auto; border: 1px solid #E5D9EC; border-radius: 14px; overflow: hidden;">
      <div style="background: #3B1050; color: #FFFFFF; padding: 16px 20px;">
        <div style="font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #F3C6DE; font-weight: 700;">YAO English Teacher Hub</div>
        <div style="font-size: 17px; font-weight: 700; margin-top: 4px;">${escapeHtml(subject)}</div>
      </div>
      <div style="padding: 20px; background: #FFFFFF; font-size: 14px; line-height: 1.6; color: #2B1B38;">
        ${escapeHtml(bodyText)}
        ${
          hubUrl
            ? `<div style="margin-top: 20px;"><a href="${hubUrl}" style="display: inline-block; background: #A8567F; color: #FFFFFF; text-decoration: none; padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 13px;">Open YAO English Teacher Hub</a></div>`
            : ''
        }
      </div>
      <div style="padding: 12px 20px; background: #FAF7FC; border-top: 1px solid #E5D9EC; font-size: 11px; color: #7A6888;">
        Sent via YAO English Teacher Hub${senderLabel ? ` · ${escapeHtml(senderLabel)}` : ''}
      </div>
    </div>
  `.trim();

  const headers = [
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody,
  ];

  return headers.join('\r\n');
}

/**
 * Sends notification emails via the user's connected Gmail account (client-side
 * Bearer token obtained via Firebase GoogleAuthProvider with gmail.send scope).
 * MUST ONLY be called after explicit user confirmation in the UI.
 */
export async function sendNotificationEmailsViaGmail(
  payload: EmailSendPayload,
  overrideToken?: string | null
): Promise<EmailSendResult> {
  const accessToken = overrideToken || getGmailAccessToken();
  if (!accessToken) {
    return {
      sentCount: 0,
      failedRecipients: payload.to,
      authExpired: true,
      errorMessage: 'Please connect Gmail first so we can send this email with your permission.',
    };
  }

  const uniqueRecipients = Array.from(
    new Set(
      payload.to
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@') && e.length >= 5)
    )
  );

  if (uniqueRecipients.length === 0) {
    return {
      sentCount: 0,
      failedRecipients: [],
      errorMessage: 'No valid recipient email addresses found.',
    };
  }

  let sentCount = 0;
  const failedRecipients: string[] = [];

  for (const recipient of uniqueRecipients) {
    const rawMime = buildMimeMessage(
      recipient,
      payload.subject,
      payload.bodyText,
      payload.senderLabel
    );
    const encoded = toBase64Url(rawMime);

    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      });

      if (res.status === 401 || res.status === 403) {
        let apiReason = '';
        try {
          const errJson = (await res.json()) as { error?: { message?: string; status?: string } };
          apiReason = errJson?.error?.message || '';
        } catch {
          // ignore parse error
        }
        clearGmailAccessToken();
        const isApiDisabled = apiReason.toLowerCase().includes('gmail api has not been used') || apiReason.toLowerCase().includes('disabled');
        return {
          sentCount,
          failedRecipients: uniqueRecipients.slice(sentCount),
          authExpired: true,
          errorMessage: isApiDisabled
            ? 'The Gmail API is not enabled yet on your Google Cloud project. Please enable Gmail API in Google Cloud Console and try again.'
            : 'Gmail send permission is needed or expired. Click "Connect Gmail & Send" and allow the Gmail checkbox in the Google popup.',
        };
      }

      if (!res.ok) {
        failedRecipients.push(recipient);
      } else {
        sentCount += 1;
      }
    } catch {
      failedRecipients.push(recipient);
    }
  }

  return {
    sentCount,
    failedRecipients,
    errorMessage:
      failedRecipients.length > 0
        ? `Sent to ${sentCount} recipient(s), but could not reach: ${failedRecipients.join(', ')}`
        : undefined,
  };
}
