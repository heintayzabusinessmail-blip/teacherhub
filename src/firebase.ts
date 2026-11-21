import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'heintayzabusinessmail@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Standard Google Sign-In only (zero restricted Workspace/Gmail scopes)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function emailToKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
      return false;
    }
    // Permission denied on test/connection confirms live server reachability
    return true;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGooglePopup() {
  return signInWithPopup(auth, googleProvider);
}

export async function sendEmailSignInLink(email: string) {
  const actionCodeSettings = {
    url: window.location.origin,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email.trim(), actionCodeSettings);
  window.localStorage.setItem('yao_email_for_signin', email.trim());
}

export async function completeEmailLinkSignInIfPresent() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    let email = window.localStorage.getItem('yao_email_for_signin') || '';
    if (!email) {
      return { needsEmailPrompt: true };
    }
    const result = await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem('yao_email_for_signin');
    window.history.replaceState({}, document.title, window.location.pathname);
    return { user: result.user, needsEmailPrompt: false };
  }
  return { needsEmailPrompt: false };
}

export async function completeEmailLinkWithAddress(email: string) {
  const result = await signInWithEmailLink(auth, email.trim(), window.location.href);
  window.localStorage.removeItem('yao_email_for_signin');
  window.history.replaceState({}, document.title, window.location.pathname);
  return result.user;
}

export async function signOutUser() {
  const currentUid = auth.currentUser?.uid;
  if (currentUid) {
    try {
      await updateDoc(doc(db, 'userPresence', currentUid), {
        isOnline: false,
        lastSeenAt: serverTimestamp(),
      });
    } catch {
      // Ignore if presence doc does not exist yet or user is offline
    }
  }
  return signOut(auth);
}
