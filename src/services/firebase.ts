import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let initError: Error | null = null;

function initFirebaseServices(): void {
  if (cachedApp || initError) return;
  try {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    cachedAuth = getAuth(cachedApp);
    // CRITICAL: Always bind to the provisioned named Firestore database ID
    cachedDb = firebaseConfig.firestoreDatabaseId
      ? getFirestore(cachedApp, firebaseConfig.firestoreDatabaseId)
      : getFirestore(cachedApp);
  } catch (err: unknown) {
    initError =
      err instanceof Error
        ? err
        : new Error('មិនអាចចាប់ផ្តើមសេវាកម្ម Firebase បានទេ។');
  }
}

export function getFirebaseAuthSafe(): Auth | null {
  initFirebaseServices();
  return cachedAuth;
}

export function getFirebaseDbSafe(): Firestore | null {
  initFirebaseServices();
  return cachedDb;
}

export function getFirebaseInitError(): Error | null {
  initFirebaseServices();
  return initError;
}

export function getFirebaseProjectId(): string {
  return firebaseConfig.projectId || '';
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const auth = getFirebaseAuthSafe();
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
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

async function testConnection(): Promise<void> {
  const db = getFirebaseDbSafe();
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
