import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;
// In-memory only access token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export function initGoogleAuth(
  onAuthReady: (user: User, token: string) => void,
  onNeedsAuth: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onAuthReady(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onNeedsAuth(user);
    }
  });
}

export async function signInWithGoogleDrive(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('មិនអាចទទួលបានសិទ្ធិចូលប្រើ Google Drive បានទេ។ សូមព្យាយាមម្តងទៀត។');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
}

export async function signOutGoogle(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}
