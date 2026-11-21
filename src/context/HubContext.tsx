import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  completeEmailLinkSignInIfPresent,
  db,
  emailToKey,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../firebase';
import type { PendingEmailDraft } from '../components/EmailConfirmModal';
import type {
  AllowlistEntry,
  AnonymousSuggestion,
  CurriculumMapDoc,
  FaqItem,
  GalleryItem,
  HelloPost,
  HubConfigDoc,
  HubNotification,
  LessonPlanSubmission,
  MeetingAgendaItem,
  NeedsSurveyDoc,
  ObservationDoc,
  OneToOneSlot,
  ResourceItem,
  SyllabusEntry,
  TeacherProfile,
  TeacherResourceState,
  TeacherWeeklyCheckin,
  TrainingResponse,
  TrainingSession,
  UserPresenceDoc,
  UserRole,
  WeeklyMeetingInfo,
  WeeklyMeetingVote,
  WelcomePackItem,
  WelcomeProgressDoc,
} from '../types';

interface HubContextValue {
  user: User | null;
  authLoading: boolean;
  needsEmailLinkConfirm: boolean;
  setNeedsEmailLinkConfirm: (v: boolean) => void;
  isAllowed: boolean;
  role: UserRole;
  isPrimaryOwner: boolean;
  isAdmin: boolean;
  isViewer: boolean;
  canInteract: boolean;
  myProfile: TeacherProfile | null;
  profileLoaded: boolean;
  syncError: Error | null;
  darkMode: boolean;
  toggleDarkMode: () => void;
  pendingEmailDraft: PendingEmailDraft | null;
  queueEmailConfirmation: (draft: PendingEmailDraft) => void;
  clearPendingEmailDraft: () => void;

  // Live collections
  allowlist: AllowlistEntry[];
  teachers: TeacherProfile[];
  hubConfig: Record<string, HubConfigDoc>;
  helloFeed: HelloPost[];
  curriculumMaps: CurriculumMapDoc[];
  galleryItems: GalleryItem[];
  resources: ResourceItem[];
  myResourceStates: Record<string, TeacherResourceState>;
  allResourceStates: TeacherResourceState[];
  trainingSessions: TrainingSession[];
  trainingResponses: TrainingResponse[];
  oneToOneSlots: OneToOneSlot[];
  observations: ObservationDoc[];
  mySurvey: NeedsSurveyDoc | null;
  allSurveys: NeedsSurveyDoc[];
  faqs: FaqItem[];
  suggestions: AnonymousSuggestion[];
  syllabusEntries: SyllabusEntry[];
  notifications: HubNotification[];
  myWeeklyCheckins: TeacherWeeklyCheckin[];
  allWeeklyCheckins: TeacherWeeklyCheckin[];
  weeklyMeetingVotes: WeeklyMeetingVote[];
  weeklyMeetingInfo: WeeklyMeetingInfo | null;
  meetingAgendaItems: MeetingAgendaItem[];
  welcomePackItems: WelcomePackItem[];
  myWelcomeProgress: WelcomeProgressDoc | null;
  lessonPlans: LessonPlanSubmission[];
  userPresences: UserPresenceDoc[];
  reportActiveTab: (tab: string) => void;
  hasSampleData: boolean;
}

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsEmailLinkConfirm, setNeedsEmailLinkConfirm] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [role, setRole] = useState<UserRole>('viewer');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [syncError, setSyncError] = useState<Error | null>(null);
  const [pendingEmailDraft, setPendingEmailDraft] = useState<PendingEmailDraft | null>(null);

  const queueEmailConfirmation = (draft: PendingEmailDraft) => setPendingEmailDraft(draft);
  const clearPendingEmailDraft = () => setPendingEmailDraft(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('yao_hub_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  // Live Firestore states
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [hubConfig, setHubConfig] = useState<Record<string, HubConfigDoc>>({});
  const [helloFeed, setHelloFeed] = useState<HelloPost[]>([]);
  const [curriculumMaps, setCurriculumMaps] = useState<CurriculumMapDoc[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [myResourceStates, setMyResourceStates] = useState<Record<string, TeacherResourceState>>({});
  const [allResourceStates, setAllResourceStates] = useState<TeacherResourceState[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [trainingResponses, setTrainingResponses] = useState<TrainingResponse[]>([]);
  const [oneToOneSlots, setOneToOneSlots] = useState<OneToOneSlot[]>([]);
  const [observations, setObservations] = useState<ObservationDoc[]>([]);
  const [mySurvey, setMySurvey] = useState<NeedsSurveyDoc | null>(null);
  const [allSurveys, setAllSurveys] = useState<NeedsSurveyDoc[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [suggestions, setSuggestions] = useState<AnonymousSuggestion[]>([]);
  const [syllabusEntries, setSyllabusEntries] = useState<SyllabusEntry[]>([]);
  const [notifications, setNotifications] = useState<HubNotification[]>([]);
  const [myWeeklyCheckins, setMyWeeklyCheckins] = useState<TeacherWeeklyCheckin[]>([]);
  const [allWeeklyCheckins, setAllWeeklyCheckins] = useState<TeacherWeeklyCheckin[]>([]);
  const [weeklyMeetingVotes, setWeeklyMeetingVotes] = useState<WeeklyMeetingVote[]>([]);
  const [weeklyMeetingInfo, setWeeklyMeetingInfo] = useState<WeeklyMeetingInfo | null>(null);
  const [meetingAgendaItems, setMeetingAgendaItems] = useState<MeetingAgendaItem[]>([]);
  const [welcomePackItems, setWelcomePackItems] = useState<WelcomePackItem[]>([]);
  const [myWelcomeProgress, setMyWelcomeProgress] = useState<WelcomeProgressDoc | null>(null);
  const [lessonPlans, setLessonPlans] = useState<LessonPlanSubmission[]>([]);
  const [userPresences, setUserPresences] = useState<UserPresenceDoc[]>([]);
  const activeTabRef = useRef<string>('home');
  const presenceDocExistsRef = useRef<boolean>(false);

  // Apply dark mode class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('yao_hub_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // Startup connection check & Email Link completion
  useEffect(() => {
    testConnection();
    completeEmailLinkSignInIfPresent()
      .then((res) => {
        if (res.needsEmailPrompt) {
          setNeedsEmailLinkConfirm(true);
        }
      })
      .catch((err) => {
        console.error('Email link sign-in completion failed:', err);
      });
  }, []);

  // Auth listener + allowlist verification
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser || !firebaseUser.email) {
        setIsAllowed(false);
        setRole('viewer');
        setProfileLoaded(false);
        setAuthLoading(false);
        return;
      }

      const lowerEmail = firebaseUser.email.toLowerCase();
      if (lowerEmail === BOOTSTRAPPED_ADMIN_EMAIL) {
        setIsAllowed(true);
        setRole('admin');
        setAuthLoading(false);
        return;
      }

      try {
        const key = emailToKey(lowerEmail);
        const allowSnap = await getDoc(doc(db, 'allowlist', key));
        if (allowSnap.exists()) {
          const data = allowSnap.data();
          setIsAllowed(true);
          setRole(
            data.role === 'admin'
              ? 'admin'
              : data.role === 'teacher'
                ? 'teacher'
                : 'viewer'
          );
        } else {
          // Anyone signing in without being added by Tr Hein gets strictly View-Only access
          setIsAllowed(true);
          setRole('viewer');
        }
      } catch (err) {
        console.error('Allowlist check error:', err);
        setIsAllowed(true);
        setRole('viewer');
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const isPrimaryOwner = user?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
  const isAdmin = role === 'admin';
  const isViewer = role === 'viewer';
  const canInteract = role === 'admin' || role === 'teacher';

  // Live Firestore subscriptions (only when authenticated AND allowlisted!)
  useEffect(() => {
    if (!user || !user.email || !isAllowed) {
      setTeachers([]);
      setAllowlist([]);
      setHubConfig({});
      setHelloFeed([]);
      setCurriculumMaps([]);
      setGalleryItems([]);
      setResources([]);
      setMyResourceStates({});
      setAllResourceStates([]);
      setTrainingSessions([]);
      setTrainingResponses([]);
      setOneToOneSlots([]);
      setObservations([]);
      setMySurvey(null);
      setAllSurveys([]);
      setFaqs([]);
      setSuggestions([]);
      setSyllabusEntries([]);
      setNotifications([]);
      setMyWeeklyCheckins([]);
      setAllWeeklyCheckins([]);
      setWeeklyMeetingVotes([]);
      setWeeklyMeetingInfo(null);
      setMeetingAgendaItems([]);
      setWelcomePackItems([]);
      setMyWelcomeProgress(null);
      setLessonPlans([]);
      setUserPresences([]);
      presenceDocExistsRef.current = false;
      setProfileLoaded(false);
      setSyncError(null);
      return;
    }

    setSyncError(null);
    const uid = user.uid;
    const myEmailKey = emailToKey(user.email);
    const unsubs: Array<() => void> = [];

    const reportSnapshotError = (err: unknown, op: OperationType, path: string) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        setSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    };

    // 1. Teachers directory
    unsubs.push(
      onSnapshot(
        collection(db, 'teachers'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as TeacherProfile), uid: d.id }));
          list.sort((a, b) => a.displayName.localeCompare(b.displayName));
          setTeachers(list);
          setProfileLoaded(true);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'teachers')
      )
    );

    // 2. Hub Config
    unsubs.push(
      onSnapshot(
        collection(db, 'hubConfig'),
        (snap) => {
          const map: Record<string, HubConfigDoc> = {};
          snap.docs.forEach((d) => {
            map[d.id] = { ...(d.data() as HubConfigDoc), id: d.id };
          });
          setHubConfig(map);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'hubConfig')
      )
    );

    // 3. Hello Feed
    unsubs.push(
      onSnapshot(
        collection(db, 'helloFeed'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as HelloPost), id: d.id }));
          list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
          setHelloFeed(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'helloFeed')
      )
    );

    // 4. Curriculum Maps
    unsubs.push(
      onSnapshot(
        collection(db, 'curriculumMaps'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as CurriculumMapDoc), id: d.id }));
          list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
          setCurriculumMaps(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'curriculumMaps')
      )
    );

    // 5. Gallery Items
    unsubs.push(
      onSnapshot(
        collection(db, 'galleryItems'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as GalleryItem), id: d.id }));
          list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
          setGalleryItems(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'galleryItems')
      )
    );

    // 6. Resources (admin gets all; teacher gets approved + own suggestions)
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'resources'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as ResourceItem), id: d.id }));
            list.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
            setResources(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'resources')
        )
      );
    } else {
      let approvedList: ResourceItem[] = [];
      let mySuggestedList: ResourceItem[] = [];
      const mergeResources = () => {
        const merged = new Map<string, ResourceItem>();
        approvedList.forEach((r) => merged.set(r.id, r));
        mySuggestedList.forEach((r) => merged.set(r.id, r));
        const arr = Array.from(merged.values());
        arr.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
        setResources(arr);
      };
      unsubs.push(
        onSnapshot(
          query(collection(db, 'resources'), where('approved', '==', true)),
          (snap) => {
            approvedList = snap.docs.map((d) => ({ ...(d.data() as ResourceItem), id: d.id }));
            mergeResources();
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'resources/approved')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'resources'), where('addedByUid', '==', uid)),
          (snap) => {
            mySuggestedList = snap.docs.map((d) => ({ ...(d.data() as ResourceItem), id: d.id }));
            mergeResources();
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'resources/mine')
        )
      );
    }

    // 7. Personal resource states (interactive users only)
    if (canInteract) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'teacherResourceStates'), where('uid', '==', uid)),
          (snap) => {
            const map: Record<string, TeacherResourceState> = {};
            snap.docs.forEach((d) => {
              const item = { ...(d.data() as TeacherResourceState), id: d.id };
              map[item.resourceId] = item;
            });
            setMyResourceStates(map);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'teacherResourceStates/mine')
        )
      );
    } else {
      setMyResourceStates({});
    }

    // 8. Training Sessions & Responses
    unsubs.push(
      onSnapshot(
        collection(db, 'trainingSessions'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as TrainingSession), id: d.id }));
          list.sort((a, b) => a.dateTimeIso.localeCompare(b.dateTimeIso));
          setTrainingSessions(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'trainingSessions')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'trainingResponses'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as TrainingResponse), id: d.id }));
          setTrainingResponses(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'trainingResponses')
      )
    );

    // 9. One-to-One Slots
    unsubs.push(
      onSnapshot(
        collection(db, 'oneToOneSlots'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as OneToOneSlot), id: d.id }));
          list.sort((a, b) => a.dateTimeIso.localeCompare(b.dateTimeIso));
          setOneToOneSlots(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'oneToOneSlots')
      )
    );

    // 10. Private Observations (Admin sees all; allowlisted teacher sees ONLY own; viewers see none)
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'observations'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as ObservationDoc), id: d.id }));
            list.sort((a, b) => a.plannedDateIso.localeCompare(b.plannedDateIso));
            setObservations(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'observations')
        )
      );
    } else if (canInteract) {
      let byUid: ObservationDoc[] = [];
      let byEmail: ObservationDoc[] = [];
      const mergeObs = () => {
        const merged = new Map<string, ObservationDoc>();
        byUid.forEach((o) => merged.set(o.id, o));
        byEmail.forEach((o) => merged.set(o.id, o));
        const arr = Array.from(merged.values());
        arr.sort((a, b) => a.plannedDateIso.localeCompare(b.plannedDateIso));
        setObservations(arr);
      };
      unsubs.push(
        onSnapshot(
          query(collection(db, 'observations'), where('teacherUid', '==', uid)),
          (snap) => {
            byUid = snap.docs.map((d) => ({ ...(d.data() as ObservationDoc), id: d.id }));
            mergeObs();
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'observations/byUid')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'observations'), where('teacherEmailKey', '==', myEmailKey)),
          (snap) => {
            byEmail = snap.docs.map((d) => ({ ...(d.data() as ObservationDoc), id: d.id }));
            mergeObs();
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'observations/byEmail')
        )
      );
    } else {
      setObservations([]);
    }

    // 11. Own Needs Survey (interactive users only)
    if (canInteract) {
      unsubs.push(
        onSnapshot(
          doc(db, 'needsSurveys', uid),
          (snap) => {
            setMySurvey(snap.exists() ? ({ ...(snap.data() as NeedsSurveyDoc), uid: snap.id }) : null);
          },
          (err) => reportSnapshotError(err, OperationType.GET, `needsSurveys/${uid}`)
        )
      );
    } else {
      setMySurvey(null);
    }

    // 12. Shared FAQs
    unsubs.push(
      onSnapshot(
        collection(db, 'faqs'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as FaqItem), id: d.id }));
          list.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
          setFaqs(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'faqs')
      )
    );

    // 12b. Live Weekly Syllabus Tracker
    unsubs.push(
      onSnapshot(
        collection(db, 'syllabusEntries'),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as SyllabusEntry), id: d.id }));
          list.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
          setSyllabusEntries(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'syllabusEntries')
      )
    );

    // 12c. Live Notifications (role-scoped to satisfy Firestore rules)
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'notifications'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as HubNotification), id: d.id }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setNotifications(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'notifications/admin')
        )
      );
    } else if (canInteract) {
      let allAudience: HubNotification[] = [];
      let teachersAudience: HubNotification[] = [];
      const mergeNotifs = () => {
        const map = new Map<string, HubNotification>();
        [...allAudience, ...teachersAudience].forEach((n) => map.set(n.id, n));
        const list = Array.from(map.values());
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setNotifications(list);
      };
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('audience', '==', 'all')),
          (snap) => {
            allAudience = snap.docs.map((d) => ({ ...(d.data() as HubNotification), id: d.id }));
            mergeNotifs();
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'notifications/all')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('audience', '==', 'teachers')),
          (snap) => {
            teachersAudience = snap.docs.map((d) => ({ ...(d.data() as HubNotification), id: d.id }));
            mergeNotifs();
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'notifications/teachers')
        )
      );
    } else {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('audience', '==', 'all')),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as HubNotification), id: d.id }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setNotifications(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'notifications/viewer')
        )
      );
    }

    // 13. Admin-only collections
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'allowlist'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as AllowlistEntry), id: d.id }));
            list.sort((a, b) => a.email.localeCompare(b.email));
            setAllowlist(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'allowlist')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'needsSurveys'),
          (snap) => {
            setAllSurveys(snap.docs.map((d) => ({ ...(d.data() as NeedsSurveyDoc), uid: d.id })));
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'needsSurveys')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'suggestions'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as AnonymousSuggestion), id: d.id }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setSuggestions(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'suggestions')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'teacherResourceStates'),
          (snap) => {
            setAllResourceStates(
              snap.docs.map((d) => ({ ...(d.data() as TeacherResourceState), id: d.id }))
            );
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'teacherResourceStates/all')
        )
      );
      unsubs.push(
        onSnapshot(
          collectionGroup(db, 'weeklyCheckins'),
          (snap) => {
            const list = snap.docs.map((d) => ({
              ...(d.data() as TeacherWeeklyCheckin),
              id: d.id,
            }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setAllWeeklyCheckins(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'weeklyCheckins/all')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'userPresence'),
          (snap) => {
            const list = snap.docs.map((d) => ({
              ...(d.data() as UserPresenceDoc),
              uid: d.id,
            }));
            list.sort((a, b) => (b.lastSeenAt?.toMillis?.() ?? 0) - (a.lastSeenAt?.toMillis?.() ?? 0));
            setUserPresences(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'userPresence')
        )
      );
    } else {
      setAllWeeklyCheckins([]);
      setUserPresences([]);
    }

    // 14. Teacher's own Weekly Feedback & Challenges (stored under /teachers/{uid}/weeklyCheckins)
    if (canInteract) {
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'teachers', uid, 'weeklyCheckins'),
            where('uid', '==', uid)
          ),
          (snap) => {
            const list = snap.docs.map((d) => ({
              ...(d.data() as TeacherWeeklyCheckin),
              id: d.id,
            }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setMyWeeklyCheckins(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, `teachers/${uid}/weeklyCheckins`)
        )
      );
    } else {
      setMyWeeklyCheckins([]);
    }

    // 15. Academic Team Weekly Meeting Votes (Tr YAO — Sunday 3-4 PM / 5-6 PM MMT / Other)
    unsubs.push(
      onSnapshot(
        collection(db, 'weeklyMeetingVotes'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...(d.data() as WeeklyMeetingVote),
            uid: d.id,
          }));
          list.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
          setWeeklyMeetingVotes(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'weeklyMeetingVotes')
      )
    );

    // 16. Weekly Meeting Zoom Link & Action Notes
    unsubs.push(
      onSnapshot(
        doc(db, 'weeklyMeetingInfo', 'current'),
        (snap) => {
          setWeeklyMeetingInfo(
            snap.exists() ? ({ ...(snap.data() as WeeklyMeetingInfo), id: snap.id }) : null
          );
        },
        (err) => reportSnapshotError(err, OperationType.GET, 'weeklyMeetingInfo/current')
      )
    );

    // 17. Weekly Meeting Agenda Items
    unsubs.push(
      onSnapshot(
        collection(db, 'meetingAgendaItems'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...(d.data() as MeetingAgendaItem),
            id: d.id,
          }));
          list.sort((a, b) => {
            if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
            return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
          });
          setMeetingAgendaItems(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'meetingAgendaItems')
      )
    );

    // 18. New Teacher Welcome Pack Items (Orientation Videos & Guides)
    unsubs.push(
      onSnapshot(
        collection(db, 'welcomePackItems'),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...(d.data() as WelcomePackItem),
            id: d.id,
          }));
          list.sort((a, b) => {
            if ((a.order ?? 99) !== (b.order ?? 99)) return (a.order ?? 99) - (b.order ?? 99);
            return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
          });
          setWelcomePackItems(list);
        },
        (err) => reportSnapshotError(err, OperationType.LIST, 'welcomePackItems')
      )
    );

    // 19. Teacher's Own Welcome Pack & Zoom Readiness Progress
    if (canInteract) {
      unsubs.push(
        onSnapshot(
          doc(db, 'teachers', uid, 'welcomeProgress', 'current'),
          (snap) => {
            setMyWelcomeProgress(
              snap.exists() ? ({ ...(snap.data() as WelcomeProgressDoc), uid }) : null
            );
          },
          (err) =>
            reportSnapshotError(err, OperationType.GET, `teachers/${uid}/welcomeProgress/current`)
        )
      );
    } else {
      setMyWelcomeProgress(null);
    }

    // 20. Weekly Lesson Plan Submissions (Admin sees all; Teacher sees own; Viewers see none)
    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'lessonPlans'),
          (snap) => {
            const list = snap.docs.map((d) => ({
              ...(d.data() as LessonPlanSubmission),
              id: d.id,
            }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setLessonPlans(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'lessonPlans/all')
        )
      );
    } else if (canInteract) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'lessonPlans'), where('teacherUid', '==', uid)),
          (snap) => {
            const list = snap.docs.map((d) => ({
              ...(d.data() as LessonPlanSubmission),
              id: d.id,
            }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setLessonPlans(list);
          },
          (err) => reportSnapshotError(err, OperationType.LIST, 'lessonPlans/mine')
        )
      );
    } else {
      setLessonPlans([]);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, isAllowed, isAdmin, canInteract]);

  const myProfile = useMemo(() => {
    if (!user) return null;
    return teachers.find((t) => t.uid === user.uid) || null;
  }, [teachers, user]);

  // Live Presence & Registered Signed-In User Heartbeat (tracks EVERY signed-in email for Admin Dashboard)
  const writePresenceHeartbeat = useCallback(
    async (online: boolean, tabOverride?: string) => {
      if (!user || !user.email || !isAllowed || authLoading) return;
      const ref = doc(db, 'userPresence', user.uid);
      const cleanEmail = user.email.toLowerCase().slice(0, 200);
      const displayName = (
        myProfile?.displayName ||
        user.displayName ||
        cleanEmail.split('@')[0] ||
        'YAO User'
      ).slice(0, 120);
      const photoUrl = (myProfile?.photoUrl || user.photoURL || '').slice(0, 150000);
      const currentTab = (tabOverride ?? activeTabRef.current ?? 'home').slice(0, 40);

      try {
        if (!presenceDocExistsRef.current) {
          const existingSnap = await getDoc(ref);
          if (existingSnap.exists()) {
            presenceDocExistsRef.current = true;
          } else {
            await setDoc(ref, {
              uid: user.uid,
              email: cleanEmail,
              displayName,
              role,
              photoUrl,
              isOnline: online,
              currentTab,
              firstSignedInAt: serverTimestamp(),
              lastSeenAt: serverTimestamp(),
            });
            presenceDocExistsRef.current = true;
            return;
          }
        }
        await updateDoc(ref, {
          displayName,
          role,
          photoUrl,
          isOnline: online,
          currentTab,
          lastSeenAt: serverTimestamp(),
        });
      } catch (err) {
        // Non-fatal: never crash a user's workspace if a background presence ping fails
        console.warn('Presence heartbeat skipped:', err);
      }
    },
    [user, isAllowed, authLoading, role, myProfile?.displayName, myProfile?.photoUrl]
  );

  const reportActiveTab = useCallback(
    (tab: string) => {
      activeTabRef.current = tab;
      void writePresenceHeartbeat(true, tab);
    },
    [writePresenceHeartbeat]
  );

  useEffect(() => {
    if (!user || !user.email || !isAllowed || authLoading) return;

    void writePresenceHeartbeat(document.visibilityState !== 'hidden');

    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void writePresenceHeartbeat(true);
      }
    }, 45_000);

    const handleVisibility = () => {
      void writePresenceHeartbeat(document.visibilityState === 'visible');
    };

    const handlePageHide = () => {
      void writePresenceHeartbeat(false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(heartbeatId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [user, isAllowed, authLoading, writePresenceHeartbeat]);

  const hasSampleData = useMemo(() => {
    return (
      teachers.some((t) => t.isSample) ||
      resources.some((r) => r.isSample) ||
      trainingSessions.some((s) => s.isSample) ||
      curriculumMaps.some((m) => m.isSample) ||
      faqs.some((f) => f.isSample) ||
      syllabusEntries.some((s) => s.isSample)
    );
  }, [teachers, resources, trainingSessions, curriculumMaps, faqs, syllabusEntries]);

  const value: HubContextValue = {
    user,
    authLoading,
    needsEmailLinkConfirm,
    setNeedsEmailLinkConfirm,
    isAllowed,
    role,
    isPrimaryOwner,
    isAdmin,
    isViewer,
    canInteract,
    myProfile,
    profileLoaded,
    syncError,
    darkMode,
    toggleDarkMode,
    pendingEmailDraft,
    queueEmailConfirmation,
    clearPendingEmailDraft,
    allowlist,
    teachers,
    hubConfig,
    helloFeed,
    curriculumMaps,
    galleryItems,
    resources,
    myResourceStates,
    allResourceStates,
    trainingSessions,
    trainingResponses,
    oneToOneSlots,
    observations,
    mySurvey,
    allSurveys,
    faqs,
    suggestions,
    syllabusEntries,
    notifications,
    myWeeklyCheckins,
    allWeeklyCheckins,
    weeklyMeetingVotes,
    weeklyMeetingInfo,
    meetingAgendaItems,
    welcomePackItems,
    myWelcomeProgress,
    lessonPlans,
    userPresences,
    reportActiveTab,
    hasSampleData,
  };

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub must be used within HubProvider');
  return ctx;
}
