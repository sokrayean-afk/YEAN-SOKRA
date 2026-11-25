import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type Auth,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let cachedAuth: Auth | null = null;
let authInitError: Error | null = null;

function getFirebaseAuthSafe(): Auth | null {
  if (cachedAuth) return cachedAuth;
  if (authInitError) return null;
  try {
    const app: FirebaseApp =
      getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (err: unknown) {
    authInitError =
      err instanceof Error
        ? err
        : new Error('មិនអាចចាប់ផ្តើមសេវាកម្មចូលគណនី Google បានទេ។');
    return null;
  }
}

let isSigningIn = false;
// In-memory only access token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
// Forces Google consent screen on next sign-in if Drive scope was missing/revoked
let needsConsentPrompt = false;

function buildGoogleProvider(forceConsent: boolean): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters(
    forceConsent
      ? { prompt: 'consent select_account', include_granted_scopes: 'true' }
      : { prompt: 'select_account', include_granted_scopes: 'true' }
  );
  return provider;
}

function mapFirebaseAuthError(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/popup-blocked':
      return new Error(
        'កម្មវិធីរុករកបានបិទផ្ទាំងចូលគណនី Google (Popup blocked)។ សូមអនុញ្ញាតផ្ទាំង Popup រួចព្យាយាមម្តងទៀត។'
      );
    case 'auth/popup-closed-by-user':
      return new Error(
        'ផ្ទាំងចូលគណនី Google ត្រូវបានបិទមុនពេលបញ្ចប់។ សូមចុចចូលគណនីម្តងទៀត។'
      );
    case 'auth/cancelled-popup-request':
      return new Error('សំណើចូលគណនីត្រូវបានផ្អាក ដោយសារមានការចុចច្រើនដង។ សូមព្យាយាមម្តងទៀត។');
    case 'auth/unauthorized-domain':
      return new Error(
        'ដែនវេបសាយនេះមិនទាន់ត្រូវបានអនុញ្ញាតសម្រាប់ការចូលគណនី Google ទេ។ សូមបន្ថែមដែននេះក្នុង Firebase Authorized Domains ឬប្រើការរក្សាទុក JSON។'
      );
    case 'auth/network-request-failed':
      return new Error('មិនអាចភ្ជាប់អ៊ីនធឺណិតបានទេ។ សូមពិនិត្យការភ្ជាប់បណ្តាញរបស់អ្នក។');
    case 'auth/operation-not-allowed':
      return new Error('មុខងារចូលគណនី Google មិនទាន់ត្រូវបានបើកនៅលើប្រព័ន្ធទេ។');
    case 'auth/internal-error':
      return new Error(
        'មានបញ្ហាបច្ចេកទេសពេលបើកផ្ទាំងចូលគណនី Google។ សូមសាកល្បងបើកក្នុងផ្ទាំង Browser ពេញ ឬព្យាយាមម្តងទៀត។'
      );
    default:
      if (error instanceof Error && error.message) {
        return error;
      }
      return new Error('ការចូលគណនី Google មិនបានជោគជ័យទេ។ សូមព្យាយាមម្តងទៀត។');
  }
}

export function initGoogleAuth(
  onAuthReady: (user: User, token: string) => void,
  onNeedsAuth: (user: User | null) => void
): () => void {
  const auth = getFirebaseAuthSafe();
  if (!auth) {
    onNeedsAuth(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onAuthReady(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onNeedsAuth(user);
    }
  });
}

export async function signInWithGoogleDrive(
  forceConsent = false
): Promise<{
  user: User;
  accessToken: string;
}> {
  const auth = getFirebaseAuthSafe();
  if (!auth) {
    throw (
      authInitError ||
      new Error('មិនអាចចាប់ផ្តើមសេវាកម្ម Google Drive បានទេ។ សូមប្រើការទាញយក JSON ជាបណ្តោះអាសន្ន។')
    );
  }
  try {
    isSigningIn = true;
    const provider = buildGoogleProvider(forceConsent || needsConsentPrompt);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'មិនអាចទទួលបានសិទ្ធិចូលប្រើ Google Drive បានទេ។ សូមធីកយល់ព្រមសិទ្ធិ Google Drive រួចព្យាយាមម្តងទៀត។'
      );
    }
    cachedAccessToken = credential.accessToken;
    needsConsentPrompt = false;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    throw mapFirebaseAuthError(error);
  } finally {
    isSigningIn = false;
  }
}

export function markNeedsConsentPrompt(): void {
  needsConsentPrompt = true;
}

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
}

export async function signOutGoogle(): Promise<void> {
  cachedAccessToken = null;
  needsConsentPrompt = false;
  const auth = getFirebaseAuthSafe();
  if (auth) {
    await auth.signOut();
  }
}
