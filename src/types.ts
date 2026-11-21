import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'teacher' | 'viewer';

export type NavTab =
  | 'home'
  | 'plan'
  | 'roadmap'
  | 'team'
  | 'resources'
  | 'training'
  | 'my-month-1'
  | 'meetings'
  | 'voice'
  | 'tools'
  | 'good-practice'
  | 'admin';

export interface AllowlistEntry {
  id: string; // normalized emailKey
  email: string;
  role: UserRole;
  displayName: string;
  addedBy: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Month1Checklist {
  profileDone: boolean;
  surveyDone: boolean;
  oneToOneBooked: boolean;
  observationScheduled: boolean;
  trainingAttended: boolean;
}

export interface TeacherProfile {
  uid: string;
  displayName: string;
  photoUrl: string;
  levels: string[];
  classesTaught: string;
  languages: string;
  yearsTeaching: number;
  goodAt: string;
  wantHelpWith: string;
  funFact: string;
  favouriteActivity: string;
  onboardingComplete: boolean;
  checklist: Month1Checklist;
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface HubConfigDoc {
  id: string;
  kind: 'pinned' | 'spotlight' | 'icebreaker' | 'progress';
  title: string;
  body: string;
  teacherUid?: string;
  teacherName?: string;
  percent?: number;
  updatedBy: string;
  updatedAt?: Timestamp | null;
}

export interface HelloPost {
  id: string;
  authorUid: string;
  authorName: string;
  type: 'hello' | 'icebreaker';
  targetName: string;
  message: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
}

export interface CurriculumMapDoc {
  id: string;
  levelName: string;
  coursebook: string;
  units: string;
  learningOutcomes: string;
  weeklyPacing: string;
  assessments: string;
  gaps: string;
  order: number;
  isSample: boolean;
  updatedAt?: Timestamp | null;
}

export interface CurriculumComment {
  id: string;
  authorUid: string;
  authorName: string;
  text: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
}

export interface GalleryItem {
  id: string;
  title: string;
  location: string;
  category: string;
  mediaType: 'photo' | 'youtube' | 'drive' | 'placeholder';
  mediaUrl: string;
  caption: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
}

export interface ResourceItem {
  id: string;
  title: string;
  level: string;
  skill: string;
  type: string;
  url: string;
  description: string;
  addedBy: string;
  addedByUid: string;
  approved: boolean;
  openCount: number;
  usedCount: number;
  thumbsUp: number;
  thumbsDown: number;
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface TeacherResourceState {
  id: string;
  uid: string;
  resourceId: string;
  bookmarked: boolean;
  used: boolean;
  rating: 'up' | 'down' | '';
  ratingComment: string;
  personalNote: string;
  lastOpenedAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface TrainingSession {
  id: string;
  title: string;
  month: number;
  dateTimeIso: string;
  durationMins: number;
  presenter: string;
  topic: string;
  zoomLink: string;
  materialsUrl: string;
  recordingUrl: string;
  tryThisWeek: string;
  status: 'upcoming' | 'completed';
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface TrainingResponse {
  id: string;
  sessionId: string;
  uid: string;
  teacherName: string;
  rsvp: 'going' | 'cannot_come' | '';
  feedbackUseful: number;
  feedbackClear: number;
  feedbackComment: string;
  reflection: string;
  isSample: boolean;
  updatedAt?: Timestamp | null;
}

export interface OneToOneSlot {
  id: string;
  dateTimeIso: string;
  durationMins: number;
  label: string;
  bookedByUid: string;
  bookedByName: string;
  notes: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ObservationDoc {
  id: string;
  teacherUid: string;
  teacherEmailKey: string;
  teacherName: string;
  levelClass: string;
  plannedDateIso: string;
  status: 'scheduled' | 'observed' | 'feedback_shared' | 'completed';
  purposeNote: string;
  whatWorked: string;
  actions: string[];
  supportAgreed: string;
  reviewDate: string;
  teacherReply: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface NeedsSurveyDoc {
  uid: string;
  teacherName: string;
  helpTopics: string[];
  feedbackStyle: string;
  bestTimes: string;
  ideas: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface FaqItem {
  id: string;
  question: string;
  level: string;
  category: string;
  explanation: string;
  example: string;
  checkingQuestion: string;
  askedByUid: string;
  askedByName: string;
  answeredBy: string;
  status: 'open' | 'answered';
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AnonymousSuggestion {
  id: string;
  category: string;
  message: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
}

export type SyllabusStatus = 'on_track' | 'slightly_behind' | 'needs_materials' | 'completed';

export interface SyllabusEntry {
  id: string;
  teacherUid: string;
  teacherName: string;
  updatedByName: string;
  levelName: string;
  className: string;
  weekLabel: string;
  plannedUnit: string;
  completedUnit: string;
  status: SyllabusStatus;
  materialsGap: string;
  isSample: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type NotificationAudience = 'admin' | 'teachers' | 'all';

export type NotificationCategory =
  | 'survey_submitted'
  | 'meeting_booked'
  | 'meeting_cancelled'
  | 'weekly_feedback'
  | 'weekly_meeting_vote'
  | 'meeting_agenda'
  | 'lesson_plan_submitted'
  | 'faq_asked'
  | 'resource_suggested'
  | 'admin_notice';

export interface HubNotification {
  id: string;
  audience: NotificationAudience;
  category: NotificationCategory;
  priority: 'normal' | 'important';
  title: string;
  message: string;
  actorUid: string;
  actorName: string;
  targetTab: string;
  readByAdmin: boolean;
  createdAt?: Timestamp | null;
}

export type WeeklyCheckinMood = 'going_well' | 'okay' | 'need_support';

export interface TeacherWeeklyCheckin {
  id: string;
  uid: string;
  teacherName: string;
  weekLabel: string;
  mood: WeeklyCheckinMood;
  wins: string;
  challenges: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type WeeklyMeetingOption = 'sun_3_4_pm' | 'sun_5_6_pm' | 'other';

export interface WeeklyMeetingVote {
  uid: string;
  teacherName: string;
  selectedOption: WeeklyMeetingOption;
  suggestedTime: string;
  note: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface WeeklyMeetingInfo {
  id: string;
  confirmedSlot: 'sun_3_4_pm' | 'sun_5_6_pm' | 'custom';
  customTimeLabel: string;
  zoomLink: string;
  meetingDateLabel: string;
  latestNotes: string;
  updatedBy: string;
  updatedAt?: Timestamp | null;
}

export interface MeetingAgendaItem {
  id: string;
  authorUid: string;
  authorName: string;
  topic: string;
  details: string;
  status: 'open' | 'discussed';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type WelcomePackCategory = 'organisation' | 'academic' | 'zoom_tools' | 'curriculum';

export interface WelcomePackItem {
  id: string;
  title: string;
  category: WelcomePackCategory;
  description: string;
  mediaUrl: string;
  durationLabel: string;
  order: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface WelcomeProgressDoc {
  uid: string;
  teacherName: string;
  watchedOrientation: boolean;
  reviewedCoursebook: boolean;
  zoomScreenShareReady: boolean;
  zoomAudioShareReady: boolean;
  zoomBreakoutRoomsReady: boolean;
  practiceLessonDone: boolean;
  updatedAt?: Timestamp | null;
}

export interface LessonPlanSubmission {
  id: string;
  teacherUid: string;
  teacherName: string;
  level: string;
  className: string;
  weekLabel: string;
  lessonObjective: string;
  stagesSummary: string;
  planUrl: string;
  status: 'submitted' | 'reviewed';
  coordinatorFeedback: string;
  reviewedBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}



