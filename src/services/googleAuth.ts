import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  getFirebaseAuthSafe,
  getFirebaseInitError,
  getFirebaseProjectId,
} from './firebase';

export { getFirebaseProjectId };

export const MASTER_ADMIN_EMAIL = 'sokrayean@gmail.com';
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export function isMasterEmail(email?: string | null): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}

let isSigningIn = false;
// In-memory only access token cache for Master Google Drive backup (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
// Forces Google consent screen on next Drive connect if Drive scope was missing/revoked
let needsConsentPrompt = false;

function buildBasicGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function buildDriveGoogleProvider(
  forceConsent: boolean,
  loginHint?: string
): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }
  const params: Record<string, string> = {
    prompt: forceConsent ? 'consent select_account' : 'select_account',
    include_granted_scopes: 'true',
  };
  if (loginHint) {
    params.login_hint = loginHint;
  }
  provider.setCustomParameters(params);
  return provider;
}

export class GoogleAuthError extends Error {
  code: string;

  constructor(message: string, code = '') {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

function mapFirebaseAuthError(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/popup-blocked':
      return new GoogleAuthError(
        'កម្មវិធីរុករកបានបិទផ្ទាំងចូលគណនី Google (Popup blocked)។ សូមអនុញ្ញាតផ្ទាំង Popup រួចព្យាយាមម្តងទៀត។',
        code
      );
    case 'auth/popup-closed-by-user':
      return new GoogleAuthError(
        'ផ្ទាំងចូលគណនី Google ត្រូវបានបិទមុនពេលបញ្ចប់។ សូមចុចចូលគណនីម្តងទៀត។',
        code
      );
    case 'auth/cancelled-popup-request':
      return new GoogleAuthError(
        'សំណើចូលគណនីត្រូវបានផ្អាក ដោយសារមានការចុចច្រើនដង។ សូមព្យាយាមម្តងទៀត។',
        code
      );
    case 'auth/unauthorized-domain':
      return new GoogleAuthError(
        'ដែនវេបសាយនេះមិនទាន់ត្រូវបានអនុញ្ញាតក្នុង Firebase Authentication ទេ។ សូមបន្ថែមដែននេះក្នុង Firebase Authorized Domains ដើម្បីចូលគណនី។',
        code
      );
    case 'auth/network-request-failed':
      return new GoogleAuthError(
        'មិនអាចភ្ជាប់អ៊ីនធឺណិតបានទេ។ សូមពិនិត្យការភ្ជាប់បណ្តាញរបស់អ្នក។',
        code
      );
    case 'auth/operation-not-allowed':
      return new GoogleAuthError(
        'មុខងារចូលគណនី Google មិនទាន់ត្រូវបានបើកនៅលើប្រព័ន្ធទេ។',
        code
      );
    case 'auth/internal-error':
      return new GoogleAuthError(
        'មានបញ្ហាបច្ចេកទេសពេលបើកផ្ទាំងចូលគណនី Google។ សូមសាកល្បងបើកក្នុងផ្ទាំង Browser ពេញ ឬព្យាយាមម្តងទៀត។',
        code
      );
    default:
      if (error instanceof Error && error.message) {
        return new GoogleAuthError(error.message, code);
      }
      return new GoogleAuthError('ការចូលគណនី Google មិនបានជោគជ័យទេ។ សូមព្យាយាមម្តងទៀត។', code);
  }
}

export function initGoogleAuth(
  onAuthState: (user: User | null, driveToken: string | null) => void
): () => void {
  const auth = getFirebaseAuthSafe();
  if (!auth) {
    onAuthState(null, null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onAuthState(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthState(null, null);
    }
  });
}

/**
 * Standard Google Sign-In for all system users (Master & Spouse).
 * Does NOT request Google Drive scopes — Drive is connected exclusively on the Master Account.
 */
export async function signInWithGoogleOnly(): Promise<User> {
  const auth = getFirebaseAuthSafe();
  if (!auth) {
    throw (
      getFirebaseInitError() ||
      new Error('មិនអាចចាប់ផ្តើមសេវាកម្មចូលគណនី Google បានទេ។')
    );
  }
  try {
    isSigningIn = true;
    const provider = buildBasicGoogleProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: unknown) {
    throw mapFirebaseAuthError(error);
  } finally {
    isSigningIn = false;
  }
}

/**
 * Master-only Google Drive connection requesting drive.file scope.
 * Stores access token strictly in memory.
 */
export async function signInWithGoogleDrive(
  forceConsent = false,
  loginHint?: string
): Promise<{
  user: User;
  accessToken: string | null;
}> {
  const auth = getFirebaseAuthSafe();
  if (!auth) {
    throw (
      getFirebaseInitError() ||
      new Error('មិនអាចចាប់ផ្តើមសេវាកម្មចូលគណនី Google បានទេ។')
    );
  }
  try {
    isSigningIn = true;
    const provider = buildDriveGoogleProvider(
      forceConsent || needsConsentPrompt,
      loginHint
    );
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    if (cachedAccessToken) {
      needsConsentPrompt = false;
    }
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
