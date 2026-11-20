export const MYANMAR_TIME_ZONE = 'Asia/Yangon';
export const MYANMAR_TIME_LABEL = 'Myanmar Time (MMT, UTC+06:30)';

export function formatLocalDateTime(iso: string): string {
  if (!iso) return 'Date to be confirmed';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: MYANMAR_TIME_ZONE,
  }).format(d);
  return `${formatted} MMT`;
}

export function formatShortDate(iso: string): string {
  if (!iso) return 'TBC';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: MYANMAR_TIME_ZONE,
  }).format(d);
}

export function getViewerTimeZone(): string {
  return MYANMAR_TIME_LABEL;
}

/**
 * Converts an ISO timestamp (or Date) into a YYYY-MM-DDTHH:mm string in Myanmar Time (UTC+06:30)
 * for <input type="datetime-local" /> controls.
 */
export function isoToMyanmarInput(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MYANMAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * Converts a YYYY-MM-DDTHH:mm value picked in Myanmar Time (UTC+06:30) into a UTC ISO string.
 */
export function myanmarInputToIso(dateTimeLocal: string): string {
  if (!dateTimeLocal) return '';
  const clean = dateTimeLocal.trim().slice(0, 16);
  const parsed = new Date(`${clean}:00+06:30`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(dateTimeLocal).toISOString();
  }
  return parsed.toISOString();
}

export function getEmbedPreviewUrl(url: string): { kind: 'iframe' | 'none'; src: string } {
  if (!url) return { kind: 'none', src: '' };
  const trimmed = url.trim();

  // YouTube
  const ytMatch =
    trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/) ||
    trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (ytMatch) {
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // Google Slides
  const slidesMatch = trimmed.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch) {
    return {
      kind: 'iframe',
      src: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed?start=false&loop=false`,
    };
  }

  // Google Docs
  const docsMatch = trimmed.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) {
    return {
      kind: 'iframe',
      src: `https://docs.google.com/document/d/${docsMatch[1]}/preview`,
    };
  }

  // Google Drive file (PDF, video, slides, etc.)
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return {
      kind: 'iframe',
      src: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    };
  }

  // Direct PDF link
  if (trimmed.toLowerCase().endsWith('.pdf')) {
    return { kind: 'iframe', src: trimmed };
  }

  return { kind: 'none', src: '' };
}

export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 320,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not prepare image canvas.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > 140000) {
          resolve(canvas.toDataURL('image/jpeg', 0.55));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface CsvResourceRow {
  title: string;
  level: string;
  skill: string;
  type: string;
  url: string;
  description: string;
}

export function parseResourcesCsv(csvText: string): CsvResourceRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const splitCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };

  const firstCols = splitCsvLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = firstCols.includes('title') && firstCols.includes('url');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: CsvResourceRow[] = [];
  for (const line of dataLines) {
    const cols = splitCsvLine(line);
    if (cols.length < 5) continue;
    const [title, level, skill, type, url, description = ''] = cols;
    if (!title || !url) continue;
    rows.push({
      title: title.slice(0, 180),
      level: (level || 'All Levels').slice(0, 40),
      skill: (skill || 'General').slice(0, 60),
      type: (type || 'Link').slice(0, 60),
      url: url.slice(0, 600),
      description: description.slice(0, 800),
    });
  }
  return rows;
}

export function getInitials(name: string): string {
  const parts = (name || 'Y').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface CalendarEventInput {
  title: string;
  startIso: string;
  durationMins: number;
  description?: string;
  location?: string;
}

function toIcsUtcTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function getGoogleCalendarUrl(event: CalendarEventInput): string {
  const start = new Date(event.startIso);
  if (Number.isNaN(start.getTime())) return 'https://calendar.google.com/';
  const end = new Date(start.getTime() + (event.durationMins || 30) * 60000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toIcsUtcTimestamp(start)}/${toIcsUtcTimestamp(end)}`,
    details: event.description || 'YAO English Teacher Hub event',
    location: event.location || 'Zoom / Online',
    ctz: MYANMAR_TIME_ZONE,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcsEvent(event: CalendarEventInput): void {
  const start = new Date(event.startIso);
  if (Number.isNaN(start.getTime())) return;
  const end = new Date(start.getTime() + (event.durationMins || 30) * 60000);
  const stamp = toIcsUtcTimestamp(new Date());
  const uid = `yao-hub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@yaoenglish`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YAO English//Teacher Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtcTimestamp(start)}`,
    `DTEND:${toIcsUtcTimestamp(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description || 'Scheduled via YAO English Teacher Hub')}`,
    `LOCATION:${escapeIcsText(event.location || 'Zoom / Online')}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: 15 minutes until your YAO English session',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  link.href = url;
  link.download = `${safeName || 'yao-event'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
