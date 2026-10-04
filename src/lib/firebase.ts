import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export interface CustomAuthSessionUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
}

const CUSTOM_SESSION_STORAGE_KEY = '5tar_custom_auth_session_v1';

export function getStoredCustomAuthUser(): CustomAuthSessionUser | null {
  try {
    const raw = localStorage.getItem(CUSTOM_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomAuthSessionUser;
  } catch {
    return null;
  }
}

export function setStoredCustomAuthUser(user: CustomAuthSessionUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(CUSTOM_SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(CUSTOM_SESSION_STORAGE_KEY, JSON.stringify(user));
    }
    window.dispatchEvent(new Event('5tar-auth-changed'));
  } catch {
    // ignore storage errors
  }
}

export function getActiveAuthUser(): {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
} | null {
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL,
      emailVerified: auth.currentUser.emailVerified,
    };
  }
  const custom = getStoredCustomAuthUser();
  if (custom) {
    return {
      uid: custom.uid,
      email: custom.email,
      displayName: custom.displayName,
      photoURL: custom.photoURL || null,
      emailVerified: true,
    };
  }
  return null;
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
  const activeUser = getActiveAuthUser();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeUser?.uid || null,
      email: activeUser?.email || null,
      emailVerified: activeUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? false,
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

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
