import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, emailToKey, handleFirestoreError, OperationType } from '../firebase';

/**
 * Seeds clearly fictional sample data (every document marked `isSample: true`)
 * so Tr Hein can explore every single page immediately and wipe all sample
 * records in one click when ready for real YAO teachers.
 */
export async function seedFictionalSampleData(adminUid: string, adminEmail: string, adminName: string) {
  const now = serverTimestamp();

  const sampleAllowlist = [
    {
      email: adminEmail.toLowerCase(),
      role: 'admin',
      displayName: adminName || 'Tr Hein Tay Za',
      isSample: false, // Never delete the admin's own entry
    },
    {
      email: 'founder.sample@yao-demo.example',
      role: 'admin',
      displayName: 'YAO Founder (Sample)',
      isSample: true,
    },
    {
      email: 'ayechan.sample@yao-demo.example',
      role: 'teacher',
      displayName: 'Ms Aye Chan (Sample)',
      isSample: true,
    },
    {
      email: 'kyawmin.sample@yao-demo.example',
      role: 'teacher',
      displayName: 'Mr Kyaw Min (Sample)',
      isSample: true,
    },
    {
      email: 'nilar.sample@yao-demo.example',
      role: 'teacher',
      displayName: 'Ms Nilar Tun (Sample)',
      isSample: true,
    },
  ];

  try {
    const batch = writeBatch(db);

    for (const entry of sampleAllowlist) {
      const id = emailToKey(entry.email);
      batch.set(doc(db, 'allowlist', id), {
        email: entry.email,
        role: entry.role,
        displayName: entry.displayName,
        addedBy: adminUid,
        isSample: entry.isSample,
        createdAt: now,
        updatedAt: now,
      });
    }

    const sampleTeachers = [
      {
        uid: 'sample_teacher_ayechan',
        displayName: 'Ms Aye Chan (Sample)',
        photoUrl: '',
        levels: ['A2', 'B1'],
        classesTaught: 'A2 Evening Group, B1 Weekend Group',
        languages: 'Burmese (native), English (C1)',
        yearsTeaching: 4,
        goodAt: 'Warm speaking warm-ups and helping shy teens feel relaxed on Zoom',
        wantHelpWith: 'Giving shorter task instructions and pacing grammar stages',
        funFact: 'I collect mugs from every city I visit and love iced green tea.',
        favouriteActivity: 'Two Truths and One Lie using the week’s target grammar',
        onboardingComplete: true,
        checklist: {
          profileDone: true,
          surveyDone: true,
          oneToOneBooked: true,
          observationScheduled: true,
          trainingAttended: true,
        },
      },
      {
        uid: 'sample_teacher_kyawmin',
        displayName: 'Mr Kyaw Min (Sample)',
        photoUrl: '',
        levels: ['B1', 'B2'],
        classesTaught: 'B1 Business English, B2 Adult Group',
        languages: 'Burmese (native), English (C1), Thai (basic)',
        yearsTeaching: 6,
        goodAt: 'Real-life business roleplays and giving clear vocabulary examples',
        wantHelpWith: 'Pronunciation drilling for consonant clusters online',
        funFact: 'I play acoustic guitar between evening Zoom classes.',
        favouriteActivity: '3-minute “Job Interview Hot Seat” in breakout rooms',
        onboardingComplete: true,
        checklist: {
          profileDone: true,
          surveyDone: true,
          oneToOneBooked: true,
          observationScheduled: true,
          trainingAttended: false,
        },
      },
      {
        uid: 'sample_teacher_nilar',
        displayName: 'Ms Nilar Tun (Sample)',
        photoUrl: '',
        levels: ['A2', 'One-to-One'],
        classesTaught: 'A2 Beginners Bridge, One-to-One Speaking',
        languages: 'Burmese (native), English (B2+)',
        yearsTeaching: 2,
        goodAt: 'Visual slides and patient scaffolding for beginners',
        wantHelpWith: 'Answering tricky tense questions quickly and clearly',
        funFact: 'I bake banana bread every Sunday morning.',
        favouriteActivity: 'Picture Storytelling Relay using Zoom whiteboard',
        onboardingComplete: true,
        checklist: {
          profileDone: true,
          surveyDone: false,
          oneToOneBooked: false,
          observationScheduled: true,
          trainingAttended: false,
        },
      },
    ];

    for (const t of sampleTeachers) {
      batch.set(doc(db, 'teachers', t.uid), {
        ...t,
        isSample: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Hub Config (Pinned note, Spotlight, Icebreaker, Progress)
    batch.set(doc(db, 'hubConfig', 'pinned'), {
      kind: 'pinned',
      title: 'Welcome to Month 1 — everything here is a draft for us to shape together!',
      body: 'Thank you for opening the YAO English Teacher Hub. Please take 2 minutes to finish your "Get to know me" card and book your friendly 15-minute 1-to-1 chat this week. No pressure and no tests — this month is all about listening to what helps you most in class.',
      updatedBy: adminName || 'Tr Hein Tay Za',
      updatedAt: now,
    });

    batch.set(doc(db, 'hubConfig', 'spotlight'), {
      kind: 'spotlight',
      title: 'Teacher of the Week Spotlight',
      body: 'Ms Aye Chan shared a brilliant 5-minute breakout room speaking warm-up that got every B1 student talking in the first 3 minutes!',
      teacherUid: 'sample_teacher_ayechan',
      teacherName: 'Ms Aye Chan (Sample)',
      updatedBy: adminName || 'Tr Hein Tay Za',
      updatedAt: now,
    });

    batch.set(doc(db, 'hubConfig', 'icebreaker'), {
      kind: 'icebreaker',
      title: 'Icebreaker of the Week',
      body: 'What is one snack or drink you always keep beside your laptop while teaching on Zoom?',
      updatedBy: adminName || 'Tr Hein Tay Za',
      updatedAt: now,
    });

    batch.set(doc(db, 'hubConfig', 'progress'), {
      kind: 'progress',
      title: 'Month 1 Team Progress',
      body: 'Week 2 of 4 — Profiles & 1-to-1 chats underway, baseline observations scheduled.',
      percent: 45,
      updatedBy: adminName || 'Tr Hein Tay Za',
      updatedAt: now,
    });

    // Hello Feed & Icebreaker Answers
    const sampleFeed = [
      {
        id: 'sample_post_1',
        authorUid: 'sample_teacher_ayechan',
        authorName: 'Ms Aye Chan (Sample)',
        type: 'icebreaker',
        targetName: '',
        message: 'Always iced green tea with honey — keeps my voice happy for 3 evening classes!',
      },
      {
        id: 'sample_post_2',
        authorUid: 'sample_teacher_kyawmin',
        authorName: 'Mr Kyaw Min (Sample)',
        type: 'hello',
        targetName: 'Ms Nilar Tun (Sample)',
        message: 'Hello Tr Nilar! Loved your picture storytelling idea — excited to work together this month.',
      },
    ];
    for (const p of sampleFeed) {
      batch.set(doc(db, 'helloFeed', p.id), {
        authorUid: p.authorUid,
        authorName: p.authorName,
        type: p.type,
        targetName: p.targetName,
        message: p.message,
        isSample: true,
        createdAt: now,
      });
    }

    // Curriculum Maps
    const sampleMaps = [
      {
        id: 'level_a2',
        levelName: 'A2',
        coursebook: 'Cambridge Empower A2 (2nd Edition)',
        units: 'Units 1–6 (Term 1) · Units 7–12 (Term 2)',
        learningOutcomes:
          'Students can talk about daily routines, past events, food, travel plans, and everyday needs in short connected sentences.',
        weeklyPacing: '1 unit per 2 weeks (2 × 60-min Zoom classes/week + short self-study review).',
        assessments: 'Unit mini-checks every 2 weeks + Mid-course speaking interview (Unit 6).',
        gaps: 'Need extra simplified slide decks for Unit 3 pronunciation and clearer audio transcripts.',
        order: 1,
      },
      {
        id: 'level_b1',
        levelName: 'B1',
        coursebook: 'Cambridge Empower B1 (2nd Edition)',
        units: 'Units 1–5 (Term 1) · Units 6–10 (Term 2)',
        learningOutcomes:
          'Students can explain opinions clearly, tell stories using narrative tenses, handle workplace chats, and sustain a 3-minute conversation.',
        weeklyPacing: '1 unit per 2 weeks with dedicated 20-minute fluency task every second lesson.',
        assessments: 'Bi-weekly speaking mini-rubric + Mid-term online quiz + End-of-level oral check.',
        gaps: 'Breakout room prompt cards needed for Unit 4 and Unit 5 speaking tasks.',
        order: 2,
      },
      {
        id: 'level_b2',
        levelName: 'B2',
        coursebook: 'Cambridge Empower B2 Digital Course',
        units: 'Units 1–5 (Term 1) · Units 6–10 (Term 2)',
        learningOutcomes:
          'Students can argue a viewpoint with reasons, lead structured discussions, understand nuanced listening clips, and self-correct common errors.',
        weeklyPacing: '1 unit per 2 weeks + optional self-study reading/listening links.',
        assessments: 'Online progress test (91-question bank) + 6-criteria CEFR speaking assessment.',
        gaps: 'Audio clip for Unit 2B needs backup Google Drive link for slow connections.',
        order: 3,
      },
      {
        id: 'level_1to1',
        levelName: 'One-to-One',
        coursebook: 'Tailored Needs-Analysis Pack (General / Business / Exam Prep)',
        units: 'Custom 4-week modules agreed after placement interview',
        learningOutcomes:
          'Goal-specific outcomes written on Lesson 1 (e.g., job interviews, confident meetings, IELTS speaking fluency).',
        weeklyPacing: 'Flexible 1–3 sessions per week tracked on individual learner sheet.',
        assessments: 'Every 4 weeks: short recorded speaking comparison + progress notes.',
        gaps: 'Create a shared folder of 10 ready-to-go Business English meeting scenarios.',
        order: 4,
      },
    ];
    for (const m of sampleMaps) {
      batch.set(doc(db, 'curriculumMaps', m.id), {
        levelName: m.levelName,
        coursebook: m.coursebook,
        units: m.units,
        learningOutcomes: m.learningOutcomes,
        weeklyPacing: m.weeklyPacing,
        assessments: m.assessments,
        gaps: m.gaps,
        order: m.order,
        isSample: true,
        updatedAt: now,
      });
    }

    // Gallery Placeholders (Coordinator Teaching in Action)
    const sampleGallery = [
      {
        id: 'sample_gallery_1',
        title: 'Teacher Mentoring Workshop',
        location: 'Myanmar / Online',
        category: 'Mentoring',
        mediaType: 'placeholder',
        mediaUrl: '',
        caption: 'Placeholder — Tr Hein will upload photos or a Google Drive / YouTube video from teacher mentoring sessions here.',
      },
      {
        id: 'sample_gallery_2',
        title: 'Business English Presentations',
        location: 'Dubai / Online',
        category: 'Business English',
        mediaType: 'placeholder',
        mediaUrl: '',
        caption: 'Placeholder — Adult Business English presentation coaching highlights.',
      },
      {
        id: 'sample_gallery_3',
        title: 'Christmas Leadership Event at Hysan Education',
        location: 'Myanmar',
        category: 'Community & Leadership',
        mediaType: 'placeholder',
        mediaUrl: '',
        caption: 'Placeholder — Student leadership showcase and festive speaking event.',
      },
      {
        id: 'sample_gallery_4',
        title: 'Speaking Buddy Online Event Host & Virtual Engagement',
        location: 'Online',
        category: 'Virtual Engagement',
        mediaType: 'placeholder',
        mediaUrl: '',
        caption: 'Placeholder — Interactive online speaking club and virtual engagement session.',
      },
    ];
    for (const g of sampleGallery) {
      batch.set(doc(db, 'galleryItems', g.id), {
        title: g.title,
        location: g.location,
        category: g.category,
        mediaType: g.mediaType,
        mediaUrl: g.mediaUrl,
        caption: g.caption,
        isSample: true,
        createdAt: now,
      });
    }

    // Resource Library
    const sampleResources = [
      {
        id: 'sample_res_1',
        title: 'B1 Pronunciation Pack: Word Stress & Sentence Rhythm on Zoom',
        level: 'B1',
        skill: 'Pronunciation',
        type: 'Activity',
        url: 'https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
        description:
          'Ready-to-use 15-minute pronunciation activity for B1 learners using clapping, visual stress bubbles, and short pair dialogues.',
        addedBy: 'Tr Hein Tay Za',
        openCount: 14,
        usedCount: 6,
        thumbsUp: 5,
        thumbsDown: 0,
      },
      {
        id: 'sample_res_2',
        title: 'YAO Standard 1-Page Lesson Plan Template (Google Docs)',
        level: 'All Levels',
        skill: 'Lesson Planning',
        type: 'Template',
        url: 'https://docs.google.com/document/d/1exampleYaoLessonPlan/edit',
        description:
          'Simple CELTA-inspired lesson staging template with clear learning objective box, timing guide, and CCQ/ICQ reminders.',
        addedBy: 'Tr Hein Tay Za',
        openCount: 22,
        usedCount: 9,
        thumbsUp: 7,
        thumbsDown: 0,
      },
      {
        id: 'sample_res_3',
        title: 'A2 Speaking Cards: Describing Food & Daily Life',
        level: 'A2',
        skill: 'Speaking',
        type: 'Slides',
        url: 'https://docs.google.com/presentation/d/1exampleA2FoodSlides/edit',
        description:
          '12 colourful picture prompt slides with sentence starters designed for A2 breakout room pairwork.',
        addedBy: 'Ms Aye Chan (Sample)',
        openCount: 11,
        usedCount: 4,
        thumbsUp: 4,
        thumbsDown: 0,
      },
      {
        id: 'sample_res_4',
        title: '6-Criteria CEFR Speaking Assessment Rubric (A2–C1)',
        level: 'All Levels',
        skill: 'Assessment',
        type: 'Rubric',
        url: 'https://drive.google.com/file/d/1exampleSpeakingRubric/view',
        description:
          'Consistent speaking marking rubric covering fluency, pronunciation, grammar range, vocabulary, interaction, and task completion.',
        addedBy: 'Tr Hein Tay Za',
        openCount: 18,
        usedCount: 7,
        thumbsUp: 6,
        thumbsDown: 0,
      },
      {
        id: 'sample_res_5',
        title: 'Welcome Pack Video: YAO Organisation & Academic Structure',
        level: 'All Levels',
        skill: 'Onboarding',
        type: 'Welcome Video',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        description:
          'Short orientation walkthrough explaining YAO’s classes, academic support flow, and who to contact for student or tech questions.',
        addedBy: 'Tr Hein Tay Za',
        openCount: 9,
        usedCount: 5,
        thumbsUp: 5,
        thumbsDown: 0,
      },
      {
        id: 'sample_res_6',
        title: 'B2 Guided Discovery Sheet: Narrative Tenses in Stories',
        level: 'B2',
        skill: 'Grammar',
        type: 'Activity',
        url: 'https://docs.google.com/document/d/1exampleB2NarrativeTenses/edit',
        description:
          'Short story text with 5 simple guiding questions so B2 students discover Past Simple vs Past Continuous vs Past Perfect themselves.',
        addedBy: 'Tr Hein Tay Za',
        openCount: 8,
        usedCount: 3,
        thumbsUp: 3,
        thumbsDown: 0,
      },
    ];
    for (const r of sampleResources) {
      batch.set(doc(db, 'resources', r.id), {
        title: r.title,
        level: r.level,
        skill: r.skill,
        type: r.type,
        url: r.url,
        description: r.description,
        addedBy: r.addedBy,
        addedByUid: adminUid,
        approved: true,
        openCount: r.openCount,
        usedCount: r.usedCount,
        thumbsUp: r.thumbsUp,
        thumbsDown: r.thumbsDown,
        isSample: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Training Sessions (Month 1 + Draft Months 2-6)
    const nowDate = new Date();
    const plusDays = (days: number, hourUtc = 11) => {
      const d = new Date(nowDate.getTime() + days * 86400000);
      d.setUTCHours(hourUtc, 0, 0, 0);
      return d.toISOString();
    };

    const sampleSessions = [
      {
        id: 'sample_train_m1_1',
        title: 'Month 1 Workshop 1: Crystal-Clear Instructions & Checking Understanding on Zoom',
        month: 1,
        dateTimeIso: plusDays(5, 11),
        durationMins: 60,
        presenter: 'Tr Hein Tay Za',
        topic: 'Shorter instructions, ICQs/CCQs, and smooth breakout room setup',
        zoomLink: 'https://zoom.us/j/1234567890',
        materialsUrl: 'https://docs.google.com/presentation/d/1exampleWorkshop1/edit',
        recordingUrl: '',
        tryThisWeek: 'Before opening breakout rooms in your next class, ask ONE quick 5-second instruction-check question (e.g., "Are we writing or speaking?").',
        status: 'upcoming',
      },
      {
        id: 'sample_train_m1_2',
        title: 'Month 1 Workshop 2: Clear Lesson Aims, Staging & Protecting Speaking Time',
        month: 1,
        dateTimeIso: plusDays(16, 11),
        durationMins: 60,
        presenter: 'Tr Hein Tay Za',
        topic: 'Using the YAO 1-page lesson plan and keeping warm-ups crisp',
        zoomLink: 'https://zoom.us/j/1234567890',
        materialsUrl: 'https://docs.google.com/document/d/1exampleWorkshop2/edit',
        recordingUrl: '',
        tryThisWeek: 'Write one student-centred aim at the top of your slide ("By the end, you can...") and reserve the last 15 minutes for speaking.',
        status: 'upcoming',
      },
      {
        id: 'sample_train_m2_1',
        title: 'Month 2 Draft: Friendly Error Correction Without Stopping Fluency',
        month: 2,
        dateTimeIso: plusDays(35, 11),
        durationMins: 60,
        presenter: 'Tr Hein Tay Za',
        topic: 'Delayed feedback boards vs instant correction on Zoom',
        zoomLink: '',
        materialsUrl: '',
        recordingUrl: '',
        tryThisWeek: 'Collect 2 great sentences and 2 errors quietly during breakout rooms and review them together at the end.',
        status: 'upcoming',
      },
      {
        id: 'sample_train_m3_1',
        title: 'Month 3 Draft: Adapting Coursebook Slides for Active Speaking',
        month: 3,
        dateTimeIso: plusDays(65, 11),
        durationMins: 60,
        presenter: 'Tr Hein & Co-Presenter (TBC)',
        topic: 'Turning dense textbook pages into clean, interactive Zoom slides',
        zoomLink: '',
        materialsUrl: '',
        recordingUrl: '',
        tryThisWeek: 'Cut text on one slide by half and turn it into a pair question.',
        status: 'upcoming',
      },
    ];
    for (const s of sampleSessions) {
      batch.set(doc(db, 'trainingSessions', s.id), {
        ...s,
        isSample: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // One-to-One Slots
    const sampleSlots = [
      {
        id: 'sample_slot_1',
        dateTimeIso: plusDays(2, 9),
        durationMins: 20,
        label: 'Week 1 Welcome 1-to-1 (with Tr Hein)',
        bookedByUid: 'sample_teacher_ayechan',
        bookedByName: 'Ms Aye Chan (Sample)',
        notes: 'Looking forward to sharing ideas for A2/B1 speaking tasks.',
      },
      {
        id: 'sample_slot_2',
        dateTimeIso: plusDays(2, 10),
        durationMins: 20,
        label: 'Week 1 Welcome 1-to-1 (with Tr Hein & Founder)',
        bookedByUid: '',
        bookedByName: '',
        notes: '',
      },
      {
        id: 'sample_slot_3',
        dateTimeIso: plusDays(3, 12),
        durationMins: 20,
        label: 'Week 1 Welcome 1-to-1 (with Tr Hein)',
        bookedByUid: '',
        bookedByName: '',
        notes: '',
      },
      {
        id: 'sample_slot_4',
        dateTimeIso: plusDays(4, 13),
        durationMins: 20,
        label: 'Week 1 Welcome 1-to-1 (with Tr Hein)',
        bookedByUid: '',
        bookedByName: '',
        notes: '',
      },
    ];
    for (const slot of sampleSlots) {
      batch.set(doc(db, 'oneToOneSlots', slot.id), {
        ...slot,
        isSample: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Sample Private Observations (one for sample teacher, one for current admin to preview My Month 1)
    const sampleObservations = [
      {
        id: 'sample_obs_1',
        teacherUid: 'sample_teacher_ayechan',
        teacherEmailKey: emailToKey('ayechan.sample@yao-demo.example'),
        teacherName: 'Ms Aye Chan (Sample)',
        levelClass: 'B1 Weekend Group',
        plannedDateIso: plusDays(8, 12),
        status: 'feedback_shared',
        purposeNote: 'Purpose: see where we are now and what you need. Not a test.',
        whatWorked:
          'Warm opening energy, clear vocabulary examples on screen, and every student spoke in breakout rooms.',
        actions: [
          'Use a visible 5-minute timer during the warm-up to keep 15 minutes for the final speaking task.',
          'Ask 1 quick checking question (ICQ) before opening breakout rooms.',
        ],
        supportAgreed: 'Tr Hein will share 3 ready-made B1 5-minute warm-up slides before Friday.',
        reviewDate: plusDays(22, 12).slice(0, 10),
        teacherReply:
          'Thank you Tr Hein! I also felt the warm-up ran slightly long, so the timer idea will really help.',
      },
      {
        id: 'sample_obs_preview_admin',
        teacherUid: adminUid,
        teacherEmailKey: emailToKey(adminEmail),
        teacherName: adminName || 'Tr Hein Tay Za',
        levelClass: 'B2 Group (Demo Preview)',
        plannedDateIso: plusDays(9, 13),
        status: 'scheduled',
        purposeNote: 'Purpose: see where we are now and what you need. Not a test.',
        whatWorked: '',
        actions: [],
        supportAgreed: '',
        reviewDate: '',
        teacherReply: '',
      },
    ];
    for (const obs of sampleObservations) {
      batch.set(doc(db, 'observations', obs.id), {
        ...obs,
        isSample: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Needs Surveys
    batch.set(doc(db, 'needsSurveys', 'sample_teacher_ayechan'), {
      uid: 'sample_teacher_ayechan',
      teacherName: 'Ms Aye Chan (Sample)',
      helpTopics: ['Lesson planning & timing', 'Zoom tools & breakout rooms'],
      feedbackStyle: 'Short friendly Zoom chat with 1–2 clear written bullet points',
      bestTimes: 'Weekday afternoons (3–5 PM MMT) or Saturday morning',
      ideas: 'A shared folder of 5-minute speaking warm-ups would save lots of prep time!',
      isSample: true,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(doc(db, 'needsSurveys', 'sample_teacher_kyawmin'), {
      uid: 'sample_teacher_kyawmin',
      teacherName: 'Mr Kyaw Min (Sample)',
      helpTopics: ['Pronunciation modelling', 'Error correction (when and how)'],
      feedbackStyle: 'Direct, practical examples of what to try next',
      bestTimes: 'Friday afternoon or Sunday afternoon',
      ideas: 'Would love a mini-session on Business English roleplay rubrics.',
      isSample: true,
      createdAt: now,
      updatedAt: now,
    });

    // Shared FAQ
    const sampleFaqs = [
      {
        id: 'sample_faq_1',
        question: 'My B1 students always confuse "since" and "for" with Present Perfect. How do I explain it simply?',
        level: 'B1',
        category: 'Grammar',
        explanation:
          'Use "for" with a length of time (you can count the hours, days, or years). Use "since" with a starting point on the calendar or clock.',
        example: 'I have lived in Yangon FOR 5 years. / I have lived in Yangon SINCE 2021.',
        checkingQuestion: 'If I say "Monday", do we use FOR or SINCE? (Since — it is a starting point!)',
        askedByUid: 'sample_teacher_ayechan',
        askedByName: 'Ms Aye Chan (Sample)',
        answeredBy: 'Tr Hein Tay Za',
        status: 'answered',
      },
      {
        id: 'sample_faq_2',
        question: 'A2 students pronounce the "-ed" ending in "worked" as two syllables ("work-id"). What is an easy fix?',
        level: 'A2',
        category: 'Pronunciation',
        explanation:
          'Only add an extra syllable /ɪd/ after the letters T or D ("wanted", "needed"). For all other verbs, just add a quick soft /t/ or /d/ sound at the end without an extra beat.',
        example: 'work → worked (1 beat, /wɜːrkt/) · want → wanted (2 beats, /ˈwɒntɪd/)',
        checkingQuestion: 'Does "played" have 1 beat or 2 beats? (1 beat! Because "play" does not end in T or D.)',
        askedByUid: 'sample_teacher_nilar',
        askedByName: 'Ms Nilar Tun (Sample)',
        answeredBy: 'Tr Hein Tay Za',
        status: 'answered',
      },
      {
        id: 'sample_faq_3',
        question: 'What is a natural way to explain the difference between "borrow" and "lend" to A2 students?',
        level: 'A2',
        category: 'Vocabulary',
        explanation:
          'Use hand gestures on camera! "Borrow" = pull towards yourself (take temporarily). "Lend" = push away from yourself (give temporarily).',
        example: 'Can I borrow your pen? (I take it) / Can you lend me your pen? (You give it to me)',
        checkingQuestion: 'If my friend gives me their umbrella for the day, did they BORROW it to me or LEND it to me? (Lend!)',
        askedByUid: 'sample_teacher_kyawmin',
        askedByName: 'Mr Kyaw Min (Sample)',
        answeredBy: 'Tr Hein Tay Za',
        status: 'answered',
      },
    ];
    for (const f of sampleFaqs) {
      batch.set(doc(db, 'faqs', f.id), {
        ...f,
        isSample: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Anonymous Suggestion
    batch.set(doc(db, 'suggestions', 'sample_suggestion_1'), {
      category: 'Training & Timing',
      message: 'Sample suggestion: Could we record every workshop and post the 3 key takeaways right beneath the video for teachers who have evening classes?',
      isSample: true,
      createdAt: now,
    });

    // Weekly Syllabus Tracker sample rows
    const sampleSyllabus = [
      {
        id: 'sample_syl_1',
        teacherUid: 'sample_teacher_ayechan',
        teacherName: 'Ms Aye Chan (Sample)',
        updatedByName: 'Ms Aye Chan (Sample)',
        levelName: 'B1',
        className: 'B1 Weekend Group',
        weekLabel: 'Month 1 · Week 2',
        plannedUnit: 'Empower B1 — Unit 2A–2B (Travel & Narrative Tenses)',
        completedUnit: 'Unit 2A–2B finished cleanly',
        status: 'completed',
        materialsGap: '',
      },
      {
        id: 'sample_syl_2',
        teacherUid: 'sample_teacher_kyawmin',
        teacherName: 'Mr Kyaw Min (Sample)',
        updatedByName: 'Mr Kyaw Min (Sample)',
        levelName: 'B2',
        className: 'B2 Adult Group',
        weekLabel: 'Month 1 · Week 2',
        plannedUnit: 'Empower B2 — Unit 2A–2B (Survival & Listening)',
        completedUnit: 'Unit 2A done; 2B audio paused',
        status: 'needs_materials',
        materialsGap: 'Unit 2B listening clip (p.22) buffered on Zoom — need a downloadable Google Drive backup audio file.',
      },
      {
        id: 'sample_syl_3',
        teacherUid: 'sample_teacher_nilar',
        teacherName: 'Ms Nilar Tun (Sample)',
        updatedByName: 'Ms Nilar Tun (Sample)',
        levelName: 'A2',
        className: 'A2 Beginners Bridge',
        weekLabel: 'Month 1 · Week 2',
        plannedUnit: 'Empower A2 — Unit 3A (Daily Routines & Pronunciation)',
        completedUnit: 'Unit 3A vocabulary done; pronunciation drill next class',
        status: 'slightly_behind',
        materialsGap: 'Would love 4 simple picture slides for Unit 3A word stress practice.',
      },
      {
        id: 'sample_syl_4',
        teacherUid: adminUid,
        teacherName: adminName || 'Tr Hein Tay Za',
        updatedByName: adminName || 'Tr Hein Tay Za',
        levelName: 'One-to-One',
        className: 'One-to-One Business Speaking (Sample)',
        weekLabel: 'Month 1 · Week 2',
        plannedUnit: 'Module 1 — Structuring Short Meeting Updates',
        completedUnit: 'Completed roleplay + recorded 2-min update',
        status: 'on_track',
        materialsGap: '',
      },
    ];
    for (const row of sampleSyllabus) {
      batch.set(doc(db, 'syllabusEntries', row.id), {
        teacherUid: row.teacherUid,
        teacherName: row.teacherName,
        updatedByName: row.updatedByName,
        levelName: row.levelName,
        className: row.className,
        weekLabel: row.weekLabel,
        plannedUnit: row.plannedUnit,
        completedUnit: row.completedUnit,
        status: row.status,
        materialsGap: row.materialsGap,
        isSample: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();

    // Also add 1 sample curriculum comment (separate write so parent exists first)
    await setDoc(doc(db, 'curriculumMaps', 'level_b1', 'comments', 'sample_comment_1'), {
      authorUid: 'sample_teacher_ayechan',
      authorName: 'Ms Aye Chan (Sample)',
      text: 'Unit 4 speaking prompts would really help my weekend B1 group — happy to help test them!',
      isSample: true,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedFictionalSampleData');
  }
}

/**
 * Deletes every document across all collections where `isSample == true`.
 * Real teacher accounts, real resources, and admin allowlist entries remain untouched.
 */
export async function clearAllSampleData(): Promise<number> {
  const collectionsToClean = [
    'allowlist',
    'teachers',
    'helloFeed',
    'galleryItems',
    'resources',
    'trainingSessions',
    'trainingResponses',
    'oneToOneSlots',
    'observations',
    'needsSurveys',
    'faqs',
    'suggestions',
    'syllabusEntries',
  ];

  let deletedCount = 0;

  try {
    // Delete curriculum map comments first, then sample curriculum maps
    const mapsSnap = await getDocs(collection(db, 'curriculumMaps'));
    for (const mapDoc of mapsSnap.docs) {
      const commentsSnap = await getDocs(
        query(collection(db, 'curriculumMaps', mapDoc.id, 'comments'), where('isSample', '==', true))
      );
      for (const c of commentsSnap.docs) {
        await deleteDoc(c.ref);
        deletedCount++;
      }
      if (mapDoc.data().isSample === true) {
        await deleteDoc(mapDoc.ref);
        deletedCount++;
      }
    }

    for (const colName of collectionsToClean) {
      const snap = await getDocs(query(collection(db, colName), where('isSample', '==', true)));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        deletedCount++;
      }
    }
    return deletedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'clearAllSampleData');
  }
}
