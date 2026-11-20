/**
 * ============================================================================
 * YAO ENGLISH TEACHER HUB — MASTER CONTENT FILE
 * ============================================================================
 * All plan wording, coordinator bio, roadmap text, jargon definitions,
 * copy-and-use tool templates, and good-practice cards live right here so
 * Tr Hein can edit any wording in one place.
 *
 * Privacy rule: Never include phone numbers, personal email, referee contacts,
 * salary/contract info, or student personal data anywhere in this file.
 */

export const BRAND = {
  appName: 'YAO English Teacher Hub',
  subtitle: 'Academic Coordinator plan: Month 1 and the road to Month 6',
  draftBadge: 'Draft plan',
  logoPath: '/assets/aistudio/YAO_English_Logo_4a78aac6.jpg',
  coordinatorPosterPath: '/assets/aistudio/profile_YAO_English_c33b7b4b.jpg',
  footerText: 'Prepared by Tr Hein Tay Za for YAO English. Draft for discussion.',
};

export const PAGE_SUMMARIES = {
  home: 'In short: See your next three actions, Tr Hein’s pinned note, and how the team is moving through Month 1.',
  plan: 'In short: Meet your Academic Coordinator, see my 9 main jobs, and read my clear promises to every teacher.',
  roadmap: 'In short: Follow our detailed Month 1 plan week by week, plus our draft roadmap for Months 2 to 6.',
  team: 'In short: Get to know every YAO teacher, see who teaches which level, and say hello to your teammates.',
  resources: 'In short: Find, preview, bookmark, and save personal notes on every YAO coursebook, slide deck, and activity.',
  training: 'In short: Join our twice-monthly training workshops, RSVP in one click, and share a short weekly reflection.',
  myMonth1: 'In short: Track your personal Month 1 checklist, book your 1-to-1 chat, and read your private observation notes.',
  voice: 'In short: Tell Tr Hein what support helps you most, search hard student questions, or send an anonymous idea.',
  tools: 'In short: Copy ready-made YAO forms for lesson planning, observations, syllabus tracking, and feedback meetings.',
  goodPractice: 'In short: See the simple, proven ideas from international English schools that guide how YAO supports teachers.',
  admin: 'In short: Manage the teacher allowlist, review Month 1 team progress, approve resources, and print your one-page report.',
};

export const JARGON_GLOSSARY: Array<{ term: string; explanation: string }> = [
  {
    term: 'CEFR',
    explanation: 'Common European Framework of Reference — the international scale for English levels (A1 beginner to C2 advanced).',
  },
  {
    term: 'CELTA',
    explanation: 'Cambridge’s internationally recognised practical teaching certificate focused on clear, student-centred lessons.',
  },
  {
    term: 'CLT',
    explanation: 'Communicative Language Teaching — helping students learn English by actually using it in real communication.',
  },
  {
    term: 'TBL',
    explanation: 'Task-Based Learning — students complete a practical real-life task (like planning a trip) while using English.',
  },
  {
    term: 'PPP / TTT',
    explanation: 'Lesson structures: Present-Practice-Produce (teach then practise) and Test-Teach-Test (check what students know first).',
  },
  {
    term: 'Guided Discovery',
    explanation: 'Helping students figure out a grammar or vocabulary rule themselves using simple examples and questions.',
  },
  {
    term: 'Checking Question (CCQ / ICQ)',
    explanation: 'A short, simple yes/no or choice question to check that students truly understand a word, rule, or task instruction.',
  },
  {
    term: 'GROW',
    explanation: 'A simple four-step coaching conversation: Goal (what we want), Reality (now), Options (ideas), Will (next step).',
  },
];

export const COORDINATOR_PROFILE = {
  headline: 'Mr Hein Tay Za, EFL Teacher, CELTA-qualified',
  location: 'Based in Indonesia, originally from Myanmar',
  languages: 'Burmese (native) · English (fluent, CEFR C1) · German (basic)',
  shortProfile:
    'I have 8+ years of experience teaching General English and Business English to teenagers and adults in Myanmar and Indonesia, both online and in the classroom. I am trained in CLT (Communicative Language Teaching — learning through real speaking), task-based learning (learning by doing practical tasks), and guided discovery (helping learners notice language patterns themselves). I build speaking confidence and help learners move up CEFR levels through clear, well-staged, learner-centred lessons. I combine teaching with curriculum design, and I mentor other teachers on lesson planning and teaching quality.',
  qualifications: [
    {
      title: 'Cambridge CELTA',
      org: 'International House Bangkok',
      detail: 'Pass (Grade B)',
      year: 'Oct 2026',
    },
    {
      title: 'Level 7 Diploma in TESOL',
      org: 'London Teacher Training College',
      detail: 'Grade B',
      year: '2026',
    },
    {
      title: 'Cambridge TKT (Modules 1, 2 & 3)',
      org: 'Cambridge Assessment English',
      detail: 'Band 3 in all three modules',
      year: '2023',
    },
    {
      title: 'British Council EnglishScore',
      org: 'British Council',
      detail: 'Score 570 · CEFR C1',
      year: '2026',
    },
    {
      title: 'Level 20 Diploma in English Communication',
      org: 'Wall Street English',
      detail: 'CEFR C1 · with letter of recommendation',
      year: 'C1 Diploma',
    },
    {
      title: 'Duolingo English Test',
      org: 'Duolingo',
      detail: '115 / 160 (CEFR B2–C1)',
      year: '2024',
    },
    {
      title: 'Bachelor of Business Administration (BBA)',
      org: 'Nusa Putra University, Indonesia',
      detail: 'In progress · Full scholarship',
      year: 'In progress',
    },
    {
      title: 'Undergraduate English Studies',
      org: 'Yangon University of Foreign Languages',
      detail: 'Earlier university studies',
      year: '2019–2020',
    },
  ],
  experienceTimeline: [
    {
      role: 'Content Manager — Nova Learn App (NOVA Creation Project)',
      period: 'Jan 2026 – Present',
      location: 'Remote / International',
      summary:
        'Led the content build for a mobile English app across 6 CEFR levels. Planned a 500+ lesson syllabus, designed the standard lesson format and a 6-criteria CEFR speaking rubric, and ran content quality checks.',
      photos: [] as Array<{ src: string; title: string; caption: string }>,
    },
    {
      role: 'Lead English Language Teacher — Let’s Talk in English (LTE Language Center)',
      period: 'Dec 2025 – Present',
      location: 'Indonesia & Online',
      summary:
        'Lead placement interviews, student needs analysis, interactive online speaking sessions, and ongoing mentoring for fellow English teachers.',
      photos: [
        {
          src: '/assets/portfolio/mentor-portrait.jpg',
          title: 'Professional Mentor',
          caption:
            'Serving as a mentor for aspiring learners and teachers, supporting personal and academic growth through goal-setting and positive coaching.',
        },
        {
          src: '/assets/portfolio/speaking-buddy-zoom.jpg',
          title: 'Online Event Host — Speaking Buddy Program',
          caption:
            'Facilitating interactive Zoom sessions where learners practise speaking confidently and share personal stories.',
        },
        {
          src: '/assets/portfolio/virtual-engagement-zoom.jpg',
          title: 'Virtual Engagement Leader',
          caption:
            'Hosting virtual classroom events with creative layouts so every online learner stays actively involved.',
        },
      ],
    },
    {
      role: 'Content & Project Work — Hysan Junior Young-Learner App',
      period: 'Project Role',
      location: 'Young Learners',
      summary:
        'Contributed curriculum content and project planning for an interactive English app built for young learners.',
      photos: [] as Array<{ src: string; title: string; caption: string }>,
    },
    {
      role: 'Center Lead Manager — Hysan Education',
      period: 'Dec 2022 – Feb 2024',
      location: 'Myanmar',
      summary:
        'Managed teachers and day-to-day center operations, taught 12 consecutive batches, ran monthly teacher coaching sessions, led oral tests and student consultations, and created educational content for the Hysan Facebook page and YouTube channel.',
      photos: [
        {
          src: '/assets/portfolio/hysan-christmas-event.jpg',
          title: 'Christmas Leadership Event — Hysan Education',
          caption:
            'Leading a festive classroom event to strengthen community bonds, with games and team activities that boost engagement and English fluency.',
        },
        {
          src: '/assets/portfolio/business-english-hosting.jpg',
          title: 'Business English Presentation & Hosting',
          caption:
            'Hosting a workshop on communication and leadership in business with live examples and active audience participation.',
        },
        {
          src: '/assets/portfolio/hysan-real-world-project.jpg',
          title: 'Real-World Project Application — Hysan Pro',
          caption:
            'Turning textbook units into practical, real-life project-based learning for adult and professional students.',
        },
        {
          src: '/assets/portfolio/hysan-content-creation.jpg',
          title: 'Educational Content Creation & Marketing',
          caption:
            'Planning, scripting, and filming educational videos and content for Hysan Education’s online channels.',
        },
      ],
    },
    {
      role: 'Senior English Language Teacher — Hysan Education',
      period: 'Jun 2022 – Dec 2022',
      location: 'Myanmar',
      summary:
        'Delivered General English and Business English courses and supported lesson quality across adult and teen cohorts.',
      photos: [
        {
          src: '/assets/portfolio/hysan-classroom-community.jpg',
          title: 'Classroom Community & Teamwork',
          caption:
            'Facilitating inclusive group interaction and teamwork during classroom activities and celebrations at Hysan Education.',
        },
        {
          src: '/assets/portfolio/hysan-classroom-project.jpg',
          title: 'Interactive Group Speaking Project',
          caption:
            'Converting course material into collaborative group projects for applied speaking practice.',
        },
        {
          src: '/assets/portfolio/business-english-workshop.jpg',
          title: 'Leadership & Business English Presentation',
          caption:
            'Co-presenting insights on Business English communication and team management at a community event.',
        },
      ],
    },
    {
      role: 'Teaching Assistant — Educator English Language School',
      period: '2019',
      location: 'Myanmar',
      summary:
        'Assisted lead teachers in classroom activities, student speaking practice, and learning support.',
      photos: [] as Array<{ src: string; title: string; caption: string }>,
    },
  ],
  curriculumBuilt: [
    'A complete Cambridge Empower B2 digital course designed for online delivery.',
    'Online progress tests (91 questions) paired with an easy-to-read teacher dashboard.',
    'An 8-month "Hello, World!" curriculum (Pre-A1 to A1) written for Indonesian teenagers.',
  ],
  professionalDevelopment: [
    'Teacher Mentorship Program — Saya Institute',
    'Certificate in Teaching Four Skills — British Council',
    'Certificate in Teaching English to Adult Learners — Care for Myanmar',
    'Certificate in Lesson Planning — Care for Myanmar',
    'Working as an Online Trainer — Online Trainer Foundation',
  ],
  community: [
    'Community English Speaking Club — Sukabumi, Indonesia',
    'Judge, Spelling Bee, English Fest 2026 — English Club, Nusa Putra University',
    'Speaking Club Organizer — "English is My Passion" (2021–2022)',
    'Teaching Assistant Facilitator — Practical English Club (2020)',
  ],
  keySkills: [
    'Learner-centred teaching',
    'CEFR-aligned lesson planning with CELTA staging (PPP, TTT, TBL, guided discovery)',
    'Zoom teaching (breakout rooms, screen and audio sharing)',
    'Pronunciation modelling',
    'Placement and level checks',
    'Assessment design',
    'Digital materials and self-study sites',
    'Class profiles and progress tracking',
    'Teacher mentoring and feedback',
  ],
  howThisHelpsYao: {
    body: 'I have been a student, a teacher, a lead teacher, a mentor, and a trainee teacher myself, so I know what teachers face in real Zoom classes. I teach YAO’s B1 and B2 groups and one-to-one classes now, so I already know YAO’s students and levels.',
    studentQuote: '“Your teaching style is easy to understand and you explain clearly.”',
    closingWish: 'My wish is that every YAO teacher hears this from their students.',
  },
};

export interface PortfolioMediaItem {
  id: string;
  title: string;
  location: string;
  category: string;
  mediaType: 'photo' | 'youtube' | 'drive';
  mediaUrl: string;
  caption: string;
}

export const TEACHING_PORTFOLIO_ITEMS: PortfolioMediaItem[] = [
  {
    id: 'portfolio-hysan-christmas',
    title: 'Christmas Leadership Event',
    location: 'Hysan Education, Myanmar',
    category: 'Community & Leadership',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/hysan-christmas-event.jpg',
    caption:
      'Leading a festive classroom event to strengthen community bonds, with games and team activities that boost engagement and English fluency.',
  },
  {
    id: 'portfolio-business-hosting',
    title: 'Business English Presentation & Hosting',
    location: 'Hysan Education, Myanmar',
    category: 'Business English',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/business-english-hosting.jpg',
    caption:
      'Hosting a workshop on communication and leadership in business, with live examples and active audience participation.',
  },
  {
    id: 'portfolio-real-world-project',
    title: 'Real-World Project Application',
    location: 'Hysan Pro, Myanmar',
    category: 'Classroom Teaching',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/hysan-real-world-project.jpg',
    caption:
      'Turning textbook units into practical, real-life project-based learning for adult and professional learners.',
  },
  {
    id: 'portfolio-classroom-project',
    title: 'Interactive Group Speaking Project',
    location: 'Hysan Education, Myanmar',
    category: 'Classroom Teaching',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/hysan-classroom-project.jpg',
    caption:
      'Converting course material into collaborative group projects for applied speaking practice.',
  },
  {
    id: 'portfolio-classroom-community',
    title: 'Classroom Community & Teamwork',
    location: 'Hysan Education, Myanmar',
    category: 'Community & Leadership',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/hysan-classroom-community.jpg',
    caption:
      'Facilitating inclusive group interaction and teamwork during classroom activities and celebrations.',
  },
  {
    id: 'portfolio-content-creation',
    title: 'Educational Content Creation & Marketing',
    location: 'Hysan Education, Myanmar',
    category: 'Curriculum & Content',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/hysan-content-creation.jpg',
    caption:
      'Planning, scripting, and filming educational content to promote English learning online.',
  },
  {
    id: 'portfolio-mentor',
    title: 'Professional Mentor',
    location: 'Myanmar & Indonesia',
    category: 'Mentoring',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/mentor-portrait.jpg',
    caption:
      'Serving as a mentor for aspiring learners and teachers, supporting personal and academic growth through goal-setting and positive coaching.',
  },
  {
    id: 'portfolio-speaking-buddy',
    title: 'Online Event Host — Speaking Buddy Program',
    location: 'Online (Zoom)',
    category: 'Virtual Engagement',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/speaking-buddy-zoom.jpg',
    caption:
      'Facilitating interactive Zoom speaking sessions so learners practise confidently and share personal stories.',
  },
  {
    id: 'portfolio-virtual-engagement',
    title: 'Virtual Engagement Leader',
    location: 'Online (Zoom)',
    category: 'Virtual Engagement',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/virtual-engagement-zoom.jpg',
    caption:
      'Hosting virtual classroom events with creative layouts so every student stays actively involved.',
  },
  {
    id: 'portfolio-leadership-presentation',
    title: 'Leadership & Business English Workshop',
    location: 'Myanmar',
    category: 'Business English',
    mediaType: 'photo',
    mediaUrl: '/assets/portfolio/business-english-workshop.jpg',
    caption:
      'Co-presenting insights on Business English communication and team management at a community event.',
  },
  {
    id: 'portfolio-video-online-1',
    title: 'Online Teaching Demo — Teaching Practices (Part 1)',
    location: 'Online (Zoom)',
    category: 'Teaching Video',
    mediaType: 'youtube',
    mediaUrl: 'https://youtu.be/TCD_MvI7r8E',
    caption: 'Live online English teaching practice session on Zoom.',
  },
  {
    id: 'portfolio-video-online-2',
    title: 'Online Teaching Demo — Teaching Practices (Part 2)',
    location: 'Online (Zoom)',
    category: 'Teaching Video',
    mediaType: 'youtube',
    mediaUrl: 'https://youtu.be/UrSh6Aa3iyw',
    caption: 'Interactive speaking practice and clear scaffolding in an online English class.',
  },
];

export interface CoordinatorJobStep {
  number: number;
  title: string;
  what: string;
  how: string;
  expect: string;
}

export const COORDINATOR_JOB_STEPS: CoordinatorJobStep[] = [
  {
    number: 1,
    title: 'Prepare new teachers before their first class',
    what: 'Make sure every new teacher feels ready and confident before meeting YAO students.',
    how: 'Walk through the level, learning outcomes, coursebook, and syllabus together; run a short practice lesson with friendly feedback; and practise key Zoom tools (screen share, audio, breakout rooms).',
    expect: 'You will never be dropped into a new class without a clear walkthrough and a chance to practise.',
  },
  {
    number: 2,
    title: 'Train and support current teachers',
    what: 'Run practical, friendly training based on real needs we see in our classes.',
    how: 'Lead two workshops a month in Month 1, co-plan tricky lessons together, demonstrate one short part first, and then give you time to practise.',
    expect: 'Short, practical workshops you can actually use in your very next class — never dry theory lectures.',
  },
  {
    number: 3,
    title: 'Review lesson plans and monitor syllabus progress',
    what: 'Check that every lesson has a clear goal and that each class stays smoothly on track.',
    how: 'Use a simple shared template focused on objectives, level fit, and timing (for example: "By the end of the lesson, students can describe a food they like and explain why") and update our weekly syllabus tracker.',
    expect: 'Quick, practical pointers to save you planning time and keep your class pacing comfortable.',
  },
  {
    number: 4,
    title: 'Observe Zoom classes in rotation',
    what: 'Visit classes regularly to see real teaching strengths and where extra support helps.',
    how: 'Rotate across all teachers, starting with new teachers, classes facing student difficulties, and lessons where we agreed to try a new idea together.',
    expect: 'You always know the date in advance — no surprise drop-ins, and observations are for growth, not a test.',
  },
  {
    number: 5,
    title: 'Give feedback and follow up',
    what: 'Turn every observation into a calm, useful conversation that helps you grow.',
    how: 'Meet privately within 2 days. You share your view of the lesson first, we celebrate what worked, agree on just 1 or 2 small changes, decide what support you need, and pick a friendly review date.',
    expect: 'Private, respectful, specific feedback focused on the lesson — never a long list of criticisms.',
  },
  {
    number: 6,
    title: 'Help answer hard student questions accurately',
    what: 'Back you up whenever a student asks a tricky grammar, vocabulary, or pronunciation question.',
    how: 'Give you a level-friendly explanation, a clear example sentence, and one quick checking question — and save the answer in our Shared FAQ so every teacher benefits.',
    expect: 'Fast help without judgement, plus a growing library of ready-to-use answers.',
  },
  {
    number: 7,
    title: 'Support individual learning needs',
    what: 'Help students who are falling behind, feeling shy, or need extra challenge.',
    how: 'Work side by side with the Student Support Coordinator to plan small classroom adjustments and targeted practice.',
    expect: 'You do not have to carry struggling students alone — we solve learning challenges as a team.',
  },
  {
    number: 8,
    title: 'Review assessments and keep marking consistent',
    what: 'Make sure students at the same level are graded fairly across different classes.',
    how: 'Review test tasks and speaking rubrics together and compare a few sample answers as a team.',
    expect: 'Clear rubrics and simple examples so marking feels fair, quick, and consistent.',
  },
  {
    number: 9,
    title: 'Report monthly to the Founder (with clear boundaries)',
    what: 'Keep the Founder informed on curriculum progress, training, and team needs.',
    how: 'Share a concise one-page monthly report. Bring an individual teaching concern to the Founder only if it continues after repeated support, affects a whole class, or requires a policy decision.',
    expect: 'Full transparency — I work with you first and will never go behind your back.',
  },
];

export const TEACHER_PROMISES = [
  'Feedback is always private, friendly, specific, and about the lesson — never about you as a person.',
  'I listen to your view first before sharing my notes.',
  'We focus on just 1 or 2 clear actions at a time, never an overwhelming list.',
  'I will not surprise you — observations and review dates are always agreed in advance.',
];

export const ROADMAP_MONTH_1_WEEKS = [
  {
    week: 'Week 1',
    title: 'Welcome & Listening',
    summary: 'Meet every teacher one-to-one (15–20 minutes, with the Founder where possible). Teachers complete their "Get to know me" profile and the Month 1 Needs Survey.',
    deliverables: [
      '1-to-1 welcome meetings with every teacher',
      'Team directory profiles completed',
      'Month 1 Needs Survey results collected',
    ],
  },
  {
    week: 'Week 2',
    title: 'Baseline Observations & Curriculum Start',
    summary: 'Observe one class for each teacher to see where we are right now (a friendly baseline, NOT a test). Begin mapping every YAO level.',
    deliverables: [
      'Baseline Zoom observation for each teacher',
      'Private 2-day feedback chats with 1–2 strengths & notes',
      'First draft of level curriculum maps started',
    ],
  },
  {
    week: 'Week 3',
    title: 'Training Session 1 & Core Tools',
    summary: 'Run Training Session 1 (led by Tr Hein). Build our 4 core teaching tools plus a short welcome pack for new teachers with recorded videos on YAO’s organisation and academic structure.',
    deliverables: [
      'Training Session 1 (led by Tr Hein)',
      '4 core tools live: Observation Form, Lesson Plan Template, Syllabus Tracker, Shared FAQ',
      'New-teacher welcome pack & orientation videos',
    ],
  },
  {
    week: 'Week 4',
    title: 'Training Session 2, Full Map & Review 1',
    summary: 'Run Training Session 2 (led by Tr Hein). Complete the curriculum map for every level, share our first one-page progress report, and hold Review 1 with the Founder.',
    deliverables: [
      'Training Session 2 (led by Tr Hein)',
      'Completed curriculum map for every level (A2, B1, B2, One-to-One)',
      'First one-page monthly report & Review 1 with Founder',
    ],
  },
];

export const ROADMAP_FUTURE_MONTHS = [
  {
    month: 2,
    title: 'Month 2: Better lessons step by step',
    isReview: false,
    tag: 'Draft: we adjust after the Month 1 review',
    points: [
      'Focus on clear instructions, checking understanding (CCQs/ICQs), and smooth online classroom management.',
      'Observe classes in rotation and agree on 1 or 2 practical changes with follow-up support.',
      'Start quick weekly lesson plan checks using the YAO template.',
    ],
  },
  {
    month: 3,
    title: 'Month 3: Strong materials & steady progress',
    isReview: true,
    reviewLabel: 'Review Point 2 (Halfway Review)',
    tag: 'Draft: we adjust after the Month 1 review',
    points: [
      'Check slides, audio files, and class activities across every level to fix gaps.',
      'Maintain steady weekly syllabus tracking across all groups.',
      'Hold Halfway Review (Month 3) with the Founder and gather team feedback.',
    ],
  },
  {
    month: 4,
    title: 'Month 4: Help students who struggle',
    isReview: false,
    tag: 'Draft: we adjust after the Month 1 review',
    points: [
      'Partner closely with the Student Support Coordinator to support learners who need extra help.',
      'Launch optional, friendly peer observations so teachers can learn ideas from one another.',
      'Expand the Shared FAQ with common student stumbling blocks.',
    ],
  },
  {
    month: 5,
    title: 'Month 5: Teachers practise and grow',
    isReview: false,
    tag: 'Draft: we adjust after the Month 1 review',
    points: [
      'Short practice teaching (micro-teaching) sessions with Tr Hein in a safe, supportive group.',
      'Watch and discuss model lessons together.',
      'Teachers lead short sharing spots showcasing their favourite classroom activities.',
    ],
  },
  {
    month: 6,
    title: 'Month 6: Check results and plan ahead',
    isReview: true,
    reviewLabel: 'Review Point 3 (6-Month Review)',
    tag: 'Draft: we adjust after the Month 1 review',
    points: [
      'Observe classes again and celebrate growth compared with Month 1 baselines.',
      'Publish the concise YAO Teacher Handbook built from our shared tools and lessons learned.',
      'Deliver the 6-month progress report and co-create our next 6-month plan.',
    ],
  },
];

export const SURVEY_HELP_TOPICS = [
  'Explaining grammar simply',
  'Pronunciation modelling',
  'Speaking activities on Zoom',
  'Error correction (when and how)',
  'Zoom tools & breakout rooms',
  'Lesson planning & timing',
  'Finding or adapting materials',
  'Answering hard student questions',
];

export const COPY_USE_TOOLS = [
  {
    id: 'observation-form',
    title: 'Class Observation Form',
    purpose: 'Used for developmental Zoom observations — focuses on strengths and 1–2 practical next steps.',
    templateText: `YAO ENGLISH — DEVELOPMENTAL CLASS OBSERVATION FORM (SAMPLE)
Teacher: Ms Aye Chan (Sample) | Level: B1 General English | Date: 12 Nov 2026
Purpose: See what is working well and agree 1–2 practical ways to support your teaching. Not a test.

1. LESSON AIM & STAGING
- Clear aim shared with students? Yes — "By the end of the lesson, students can compare two travel choices."
- Smooth transition between warm-up, presentation, and speaking practice.

2. CLARITY & CHECKING UNDERSTANDING
- Instructions were short and shown on the slide.
- Idea to try: Ask one quick instruction-check question (ICQ) before opening breakout rooms (e.g., "How many minutes? Alone or in pairs?").

3. STUDENT SPEAKING & ENGAGEMENT
- Warm, encouraging tone; quiet students invited by name.
- Great use of Zoom chat for quick vocabulary ideas.

4. PRIVATE FEEDBACK SUMMARY (AGREED TOGETHER)
- Teacher's reflection first: "The warm-up ran 5 minutes longer than planned, so the final speaking task felt rushed."
- What worked well: Friendly atmosphere, clear model sentences, helpful pronunciation drill.
- 1–2 Agreed Actions:
  1. Set a 5-minute visible timer for the warm-up so speaking practice gets a full 15 minutes.
  2. Add 1 ICQ before breakout rooms.
- Support from Tr Hein: Share 3 ready-made 5-minute warm-up slides for B1.
- Review Date: 26 Nov 2026`,
  },
  {
    id: 'lesson-plan',
    title: 'Lesson Plan Template',
    purpose: 'A simple 1-page plan built around one clear student outcome and realistic Zoom timing.',
    templateText: `YAO ENGLISH — SIMPLE LESSON PLAN TEMPLATE (SAMPLE)
Teacher: Mr Kyaw Min (Sample) | Level: A2 Evening Group | Lesson Length: 60 mins
Coursebook & Unit: Empower A2 — Unit 4A (Food & Meals)

LEARNING OBJECTIVE (What students can DO by the end):
"By the end of the lesson, students can describe a food they like and explain why in 3–4 sentences."

STAGE 1 — WARM-UP (5 mins)
- Show 3 photos of popular dishes. Ask in chat: "Which one would you eat tonight?"

STAGE 2 — VOCABULARY & MODEL (15 mins)
- Teach 6 taste adjectives (spicy, crispy, sweet, fresh, creamy, savoury).
- Model pronunciation + stress; ask 2 checking questions (e.g., "Is ice cream crispy or creamy?").

STAGE 3 — CONTROLLED PRACTICE (15 mins)
- Quick matching task on screen + sentence starter: "My favourite dish is ___ because it is ___."

STAGE 4 — SPEAKING TASK IN BREAKOUT ROOMS (20 mins)
- Pairs ask and answer 3 questions about their favourite local dish.
- Teacher monitors rooms and notes 3 good sentences + 2 errors to review.

STAGE 5 — FEEDBACK & WRAP-UP (5 mins)
- Praise 2 strong student examples; fix 1 pronunciation slip together; set quick homework.`,
  },
  {
    id: 'syllabus-tracker',
    title: 'Weekly Syllabus Tracker',
    purpose: 'Updated weekly so every class at the same level stays paced and materials gaps are caught early.',
    templateText: `YAO ENGLISH — WEEKLY SYLLABUS TRACKER (SAMPLE)
Level: B2 Group A | Coursebook: Empower B2 | Term: Month 1

Week 1 | Planned: Unit 1A–1B (Character & Present Perfect) | Completed: Unit 1A–1B | Status: On track | Notes: Students loved the job interview roleplay.
Week 2 | Planned: Unit 1C–1D (Everyday English & Review) | Completed: Unit 1C | Status: 1 lesson behind | Notes: Needed extra 20 mins on listening audio; will catch up in Week 3 warm-up.
Week 3 | Planned: Unit 2A–2B (Survival & Narrative Tenses) | Completed: Planned | Status: Ready | Materials gap: Need cleaner B2 audio clip for p.22 (reported to Tr Hein).
Week 4 | Planned: Unit 2C + Mini Progress Check | Completed: Planned | Status: Ready | Assessment: 15-min speaking pair check using YAO rubric.`,
  },
  {
    id: 'feedback-script',
    title: 'Feedback Meeting Script (5 Steps)',
    purpose: 'The exact 5-step structure Tr Hein uses in every private post-observation chat.',
    templateText: `YAO ENGLISH — 5-STEP DEVELOPMENTAL FEEDBACK SCRIPT
Duration: 15–20 minutes | Private 1-to-1 | Within 2 days of observation

STEP 1 — LISTEN FIRST (4 mins)
"Thank you for welcoming me into your class! Before I share my notes, how did the lesson feel to you? What are you happiest with, and was there any moment that felt tricky?"

STEP 2 — SHARE SPECIFIC EXAMPLES (4 mins)
"Here are two moments that really helped your students learn: [exact example 1] and [exact example 2]. And here is one moment where we can make things even smoother: [neutral, specific example]."

STEP 3 — AGREE 1 OR 2 CHANGES (4 mins)
"If we pick just ONE (or at most two) small changes to try over the next two weeks, what feels most useful for your class?"

STEP 4 — AGREE SUPPORT (3 mins)
"How can I help make this easy for you? Would you like a sample slide, a 10-minute co-planning chat, or a quick demo?"

STEP 5 — SET REVIEW DATE (2 mins)
"Let’s check in on [Date] to see how it went and celebrate what improved. Thank you again!"`,
  },
];

export const GOOD_PRACTICE_CARDS = [
  {
    title: 'Teacher Development Frameworks',
    source: 'British Council CPD Framework & Cambridge Teaching Framework',
    idea: 'Clear stages of teaching skills (planning, classroom language, assessment, reflection) help teachers see what to learn next without feeling judged.',
    howYaoUsesIt: 'We use these clear areas to design our Needs Survey and pick practical monthly workshop topics that match our team.',
  },
  {
    title: 'Developmental, Not Judgemental, Observation',
    source: 'International ELT Mentoring Standard',
    idea: 'Observations work best when their goal is growth and dialogue — not a score or surprise inspection.',
    howYaoUsesIt: 'Every Month 1 observation is a friendly baseline with advance notice, private feedback within 2 days, and at most 1–2 agreed actions.',
  },
  {
    title: 'Peer Observation',
    source: 'Collaborative School Practice',
    idea: 'Teachers learn huge amounts simply by watching a colleague teach for 20 minutes and noticing one great technique to borrow.',
    howYaoUsesIt: 'Starting in Month 4, we invite teachers to join optional, friendly peer visits focused only on collecting good ideas.',
  },
  {
    title: 'Practice Teaching (CELTA-Style Micro-Teaching)',
    source: 'Cambridge CELTA Training Model',
    idea: 'Practising a 5-minute instruction or grammar check with fellow teachers builds confidence before trying it with real students.',
    howYaoUsesIt: 'In our workshops and Month 5 sessions, Tr Hein demos one short stage first, then teachers practise safely together.',
  },
  {
    title: 'The Reflective Cycle',
    source: 'Plan → Teach → Reflect → Adjust',
    idea: 'Small, steady improvements come from pausing for 2 minutes after class to ask what worked and what to tweak next time.',
    howYaoUsesIt: 'After each training workshop, teachers get one small "Try this week" idea and post a one-line reflection in the Hub.',
  },
  {
    title: 'GROW Coaching Conversations',
    source: 'Goal · Reality · Options · Will',
    idea: 'Great mentors ask good questions first instead of lecturing, helping teachers own their own classroom solutions.',
    howYaoUsesIt: 'Our 5-step feedback meeting always lets the teacher speak first and choose their own 1–2 next steps.',
  },
  {
    title: '30-60-90 Day Onboarding Plan',
    source: 'Structured Academic Induction',
    idea: 'New teachers thrive when they know exactly what to focus on in their first 30, 60, and 90 days.',
    howYaoUsesIt: 'Our Month 1 Welcome Pack (orientation videos, coursebook walkthrough, practice lesson, and early check-in) sets every new hire up to succeed.',
  },
];

export const ADMIN_TARGETS = [
  {
    id: 'obs-monthly',
    title: 'Observe every teacher at least once a month',
    detail: 'Planned in rotation with advance notice — developmental baseline in Month 1.',
  },
  {
    id: 'feedback-2days',
    title: 'Private feedback meeting within 2 days',
    detail: 'Teacher speaks first; agree 1 or 2 clear actions and a review date.',
  },
  {
    id: 'training-twice',
    title: 'Training twice a month',
    detail: 'Month 1 led by Tr Hein; from later months, teachers also co-lead sessions.',
  },
  {
    id: 'syllabus-weekly',
    title: 'Syllabus tracker updated weekly',
    detail: 'Keeps same-level classes aligned and flags pacing or materials gaps early.',
  },
  {
    id: 'materials-m3',
    title: 'Materials checked for every level by Month 3',
    detail: 'Slides, audio files, activities, and assessments verified across all YAO levels.',
  },
  {
    id: 'faq-weekly',
    title: 'Shared FAQ grows weekly',
    detail: 'Every hard student question gets an explanation, example, and checking question.',
  },
];
