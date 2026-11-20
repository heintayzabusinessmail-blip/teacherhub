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
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'heintayzabusinessmail@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
];

export const googleProvider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => googleProvider.addScope(scope));
googleProvider.setCustomParameters({ prompt: 'select_account' });

// In-memory cache ONLY for Google Workspace OAuth access token (never stored in localStorage/sessionStorage)
let cachedGmailAccessToken: string | null = null;
const tokenListeners = new Set<(connected: boolean) => void>();

function setCachedGmailToken(token: string | null) {
  cachedGmailAccessToken = token;
  const connected = Boolean(token);
  tokenListeners.forEach((fn) => fn(connected));
}

export function subscribeGmailTokenState(listener: (connected: boolean) => void): () => void {
  tokenListeners.add(listener);
  listener(Boolean(cachedGmailAccessToken));
  return () => {
    tokenListeners.delete(listener);
  };
}

export function getGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export function clearGmailAccessToken(): void {
  setCachedGmailToken(null);
}

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
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    setCachedGmailToken(credential.accessToken);
  }
  return result;
}

/**
 * Re-requests Google Workspace Gmail permission in a user-clicked popup
 * when the in-memory access token is absent (e.g., after a browser refresh).
 */
export async function connectGmailPopup(): Promise<string | null> {
  const gmailProvider = new GoogleAuthProvider();
  WORKSPACE_SCOPES.forEach((scope) => gmailProvider.addScope(scope));
  const loginHint = auth.currentUser?.email || undefined;
  gmailProvider.setCustomParameters({
    prompt: 'consent',
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  const result = await signInWithPopup(auth, gmailProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || null;
  setCachedGmailToken(token);
  return token;
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
  clearGmailAccessToken();
  return signOut(auth);
}
