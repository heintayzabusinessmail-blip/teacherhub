import { jsPDF } from 'jspdf';
import {
  BRAND,
  COORDINATOR_JOB_STEPS,
  COORDINATOR_PROFILE,
  JARGON_GLOSSARY,
  ROADMAP_FUTURE_MONTHS,
  ROADMAP_MONTH_1_WEEKS,
  TEACHER_PROMISES,
} from '../content/planContent';
import type { CurriculumMapDoc, SyllabusEntry } from '../types';

const PURPLE: [number, number, number] = [59, 16, 80]; // #3B1050
const MAUVE: [number, number, number] = [168, 86, 127]; // #A8567F
const INK: [number, number, number] = [31, 18, 43];
const MUTED: [number, number, number] = [90, 74, 102];
const SOFT_BG: [number, number, number] = [244, 238, 247];

class YaoPdfBuilder {
  doc: jsPDF;
  y = 20;
  pageWidth: number;
  pageHeight: number;
  margin = 16;
  maxWidth: number;

  constructor(title: string, subtitle: string) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.maxWidth = this.pageWidth - this.margin * 2;
    this.drawHeader(title, subtitle);
  }

  private drawHeader(title: string, subtitle: string) {
    this.doc.setFillColor(...PURPLE);
    this.doc.rect(0, 0, this.pageWidth, 30, 'F');

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(15);
    this.doc.text(title, this.margin, 13);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(236, 210, 228);
    this.doc.text(subtitle, this.margin, 20.5);

    this.doc.setFontSize(8);
    this.doc.text('DRAFT PLAN FOR DISCUSSION · YAO ENGLISH TEACHER HUB', this.margin, 26.5);

    this.y = 38;
  }

  ensureSpace(neededMm: number) {
    if (this.y + neededMm > this.pageHeight - 18) {
      this.doc.addPage();
      this.y = 18;
    }
  }

  sectionHeading(text: string) {
    this.ensureSpace(14);
    this.y += 3;
    this.doc.setFillColor(...SOFT_BG);
    this.doc.roundedRect(this.margin, this.y - 4.5, this.maxWidth, 8.5, 1.5, 1.5, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(...PURPLE);
    this.doc.text(text, this.margin + 3, this.y + 1.2);
    this.y += 8.5;
  }

  subHeading(text: string) {
    this.ensureSpace(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...MAUVE);
    const lines = this.doc.splitTextToSize(text, this.maxWidth);
    this.doc.text(lines, this.margin, this.y);
    this.y += lines.length * 4.8 + 1;
  }

  paragraph(text: string, indent = 0, muted = false) {
    if (!text.trim()) return;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...(muted ? MUTED : INK));
    const lines = this.doc.splitTextToSize(text, this.maxWidth - indent);
    for (const line of lines) {
      this.ensureSpace(5.5);
      this.doc.text(line, this.margin + indent, this.y);
      this.y += 4.6;
    }
    this.y += 1.6;
  }

  bullet(text: string, boldPrefix?: string) {
    const full = boldPrefix ? `${boldPrefix}: ${text}` : text;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.2);
    this.doc.setTextColor(...INK);
    const lines = this.doc.splitTextToSize(`•  ${full}`, this.maxWidth - 3);
    for (const line of lines) {
      this.ensureSpace(5);
      this.doc.text(line, this.margin + 2, this.y);
      this.y += 4.5;
    }
    this.y += 0.8;
  }

  spacer(mm = 3) {
    this.y += mm;
  }

  save(filename: string) {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setDrawColor(229, 217, 236);
      this.doc.line(this.margin, this.pageHeight - 12, this.pageWidth - this.margin, this.pageHeight - 12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED);
      this.doc.text(BRAND.footerText, this.margin, this.pageHeight - 7.5);
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - this.margin, this.pageHeight - 7.5, {
        align: 'right',
      });
    }
    this.doc.save(filename);
  }
}

export function downloadPlanPdf() {
  const pdf = new YaoPdfBuilder(
    'YAO English — Academic Coordinator Plan',
    'Meet Tr Hein Tay Za, My 9 Jobs, and Clear Promises to Every Teacher'
  );

  pdf.sectionHeading('1. Meet Your Academic Coordinator');
  pdf.subHeading(COORDINATOR_PROFILE.headline);
  pdf.paragraph(`${COORDINATOR_PROFILE.location}  |  Languages: ${COORDINATOR_PROFILE.languages}`, 0, true);
  pdf.paragraph(COORDINATOR_PROFILE.shortProfile);

  pdf.subHeading('How This Helps YAO Teachers');
  pdf.paragraph(COORDINATOR_PROFILE.howThisHelpsYao.body);
  pdf.paragraph(`Feedback from YAO students: ${COORDINATOR_PROFILE.howThisHelpsYao.studentQuote}`, 2, true);
  pdf.paragraph(COORDINATOR_PROFILE.howThisHelpsYao.closingWish);

  pdf.sectionHeading('2. Qualifications & Credentials');
  COORDINATOR_PROFILE.qualifications.forEach((q) => {
    pdf.bullet(`${q.org} — ${q.detail} (${q.year})`, q.title);
  });

  pdf.sectionHeading('3. Experience Timeline');
  COORDINATOR_PROFILE.experienceTimeline.forEach((exp) => {
    pdf.subHeading(`${exp.role} (${exp.period} · ${exp.location})`);
    pdf.paragraph(exp.summary, 2);
  });

  pdf.subHeading('Curriculum & Materials Built');
  COORDINATOR_PROFILE.curriculumBuilt.forEach((c) => pdf.bullet(c));

  pdf.subHeading('Professional Development & Community');
  COORDINATOR_PROFILE.professionalDevelopment.forEach((p) => pdf.bullet(p));
  COORDINATOR_PROFILE.community.forEach((c) => pdf.bullet(c));

  pdf.subHeading('Key Skills');
  pdf.paragraph(COORDINATOR_PROFILE.keySkills.join(' · '));

  pdf.sectionHeading('4. My Job in 9 Simple Steps');
  COORDINATOR_JOB_STEPS.forEach((step) => {
    pdf.subHeading(`${step.number}. ${step.title}`);
    pdf.bullet(step.what, 'What');
    pdf.bullet(step.how, 'How');
    pdf.bullet(step.expect, 'What you can expect');
    pdf.spacer(1);
  });

  pdf.sectionHeading('5. My Promises to Every Teacher');
  TEACHER_PROMISES.forEach((p, idx) => {
    pdf.bullet(p, `Promise 0${idx + 1}`);
  });

  pdf.sectionHeading('6. Plain-English Teaching Glossary');
  JARGON_GLOSSARY.forEach((g) => {
    pdf.bullet(g.explanation, g.term);
  });

  pdf.save('YAO-English-Academic-Coordinator-Plan.pdf');
}

export function downloadRoadmapPdf(
  curriculumMaps: CurriculumMapDoc[],
  syllabusEntries: SyllabusEntry[]
) {
  const pdf = new YaoPdfBuilder(
    'YAO English — 6-Month Roadmap & Curriculum Map',
    'Month 1 Week-by-Week Plan, Draft Months 2–6 Outline, and Live Class Tracker'
  );

  pdf.sectionHeading('1. Month 1: Week-by-Week Plan (Full Detail)');
  ROADMAP_MONTH_1_WEEKS.forEach((w) => {
    pdf.subHeading(`${w.week} — ${w.title}`);
    pdf.paragraph(w.summary);
    w.deliverables.forEach((d) => pdf.bullet(d));
  });

  pdf.sectionHeading('2. Months 2 to 6 Outline (Draft: Adjusted After Month 1 Review)');
  ROADMAP_FUTURE_MONTHS.forEach((m) => {
    pdf.subHeading(`${m.title}${m.isReview && m.reviewLabel ? ` — ${m.reviewLabel}` : ''}`);
    m.points.forEach((pt) => pdf.bullet(pt));
  });

  if (curriculumMaps.length > 0) {
    pdf.sectionHeading('3. Month 1 Curriculum Map by Level');
    curriculumMaps.forEach((m) => {
      pdf.subHeading(`${m.levelName} — ${m.coursebook || 'Coursebook TBC'}`);
      if (m.units) pdf.bullet(m.units, 'Units');
      if (m.weeklyPacing) pdf.bullet(m.weeklyPacing, 'Weekly Pacing');
      if (m.learningOutcomes) pdf.bullet(m.learningOutcomes, 'Learning Outcomes');
      if (m.assessments) pdf.bullet(m.assessments, 'Assessments');
      if (m.gaps) pdf.bullet(m.gaps, 'Known Gaps');
    });
  }

  if (syllabusEntries.length > 0) {
    pdf.sectionHeading('4. Live Weekly Syllabus Tracker Snapshot');
    syllabusEntries.forEach((s) => {
      const statusLabel = s.status.replace(/_/g, ' ');
      pdf.subHeading(`${s.levelName} · ${s.className} (${s.weekLabel} — ${s.teacherName})`);
      pdf.bullet(s.plannedUnit, 'Planned');
      pdf.bullet(s.completedUnit || 'In progress', 'Completed');
      pdf.bullet(statusLabel, 'Status');
      if (s.materialsGap.trim()) {
        pdf.bullet(s.materialsGap, 'Materials Gap Flagged');
      }
    });
  }

  pdf.save('YAO-English-6-Month-Roadmap.pdf');
}

export function downloadMonth1ReportPdf(params: {
  obsCompleted: number;
  obsTotal: number;
  bookedSlots: number;
  workshopsCount: number;
  answeredFaqs: number;
  agreedActions: string[];
  flaggedGaps: Array<{ levelName: string; className: string; note: string }>;
  supportNote: string;
  nextSteps: string;
}) {
  const pdf = new YaoPdfBuilder(
    'YAO English — Month 1 Academic Progress Report',
    'One-Page Founder Summary (Prepared by Tr Hein Tay Za · Zero Student PII)'
  );

  pdf.sectionHeading('1. Month 1 Snapshot Metrics');
  pdf.bullet(`${params.obsCompleted} / ${params.obsTotal} baseline classes observed`, 'Observations');
  pdf.bullet(`${params.bookedSlots} welcome 1-to-1 chats booked`, '1-to-1 Meetings');
  pdf.bullet(`${params.workshopsCount} Month 1 training workshops scheduled`, 'Teacher Training');
  pdf.bullet(`${params.answeredFaqs} answered entries in Shared Teacher FAQ`, 'Shared FAQ');

  pdf.sectionHeading('2. Changes Agreed From Observations');
  if (params.agreedActions.length === 0) {
    pdf.paragraph('Baseline observations are currently in progress.');
  } else {
    params.agreedActions.forEach((a) => pdf.bullet(a));
  }

  pdf.sectionHeading(`3. Materials Gaps Flagged by Teachers (${params.flaggedGaps.length})`);
  if (params.flaggedGaps.length === 0) {
    pdf.paragraph('No unresolved materials gaps reported in the Weekly Syllabus Tracker.');
  } else {
    params.flaggedGaps.forEach((g) => pdf.bullet(g.note, `${g.levelName} (${g.className})`));
  }

  pdf.sectionHeading('4. Students Needing Support (Group-Level Summary — No Personal Data)');
  pdf.paragraph(params.supportNote || 'No group-level notes entered.');

  pdf.sectionHeading('5. Actions & Month 2 Next Steps');
  params.nextSteps
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => pdf.paragraph(line));

  pdf.save('YAO-English-Month-1-Report.pdf');
}

export function downloadTemplatePdf(title: string, purpose: string, templateText: string) {
  const pdf = new YaoPdfBuilder(`YAO English — ${title}`, purpose);

  pdf.sectionHeading(title);
  const lines = templateText.split('\n');
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      pdf.spacer(2.5);
    } else if (/^\d+\.\s+[A-Z]/.test(line) || /^[A-Z][A-Z0-9\s—–-]+:$/.test(line)) {
      pdf.subHeading(line);
    } else if (line.trim().startsWith('- ')) {
      pdf.bullet(line.trim().slice(2));
    } else {
      pdf.paragraph(line);
    }
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  pdf.save(`YAO-English-${slug || 'template'}.pdf`);
}
