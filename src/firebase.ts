import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  setPersistence,
  inMemoryPersistence,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import rawFirebaseConfig from '../firebase-applet-config.json';

const OPTIMIS_DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyANkAaPH6wBAp-qDsjBCLwnvvCjOSgHKa8',
  authDomain: 'optimis-97d75.firebaseapp.com',
  projectId: 'optimis-97d75',
  storageBucket: 'optimis-97d75.firebasestorage.app',
  messagingSenderId: '299120054201',
  appId: '1:299120054201:web:6701b7127e282e22a1f068',
  measurementId: 'G-VF0GHQL14R',
  firestoreDatabaseId: '(default)',
};

const env = import.meta.env || {};

const isValidCustomProject =
  rawFirebaseConfig?.projectId &&
  rawFirebaseConfig.projectId !== 'gen-lang-client-0630018891' &&
  rawFirebaseConfig.projectId !== 'remixed-project-id';

const baseConfig = isValidCustomProject
  ? rawFirebaseConfig
  : OPTIMIS_DEFAULT_FIREBASE_CONFIG;

const resolvedProjectId =
  env.VITE_FIREBASE_PROJECT_ID ||
  baseConfig.projectId ||
  OPTIMIS_DEFAULT_FIREBASE_CONFIG.projectId;

const rawDbId =
  env.VITE_FIREBASE_DATABASE_ID ||
  baseConfig.firestoreDatabaseId ||
  '(default)';

const resolvedDatabaseId =
  !rawDbId ||
  ((resolvedProjectId === 'optimis-97d75' ||
    resolvedProjectId === 'e-lamisblora') &&
    rawDbId.startsWith('ai-studio-'))
    ? '(default)'
    : rawDbId;

export const firebaseConfig = {
  apiKey:
    env.VITE_FIREBASE_API_KEY ||
    baseConfig.apiKey ||
    OPTIMIS_DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN ||
    baseConfig.authDomain ||
    OPTIMIS_DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: resolvedProjectId,
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    baseConfig.storageBucket ||
    OPTIMIS_DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    baseConfig.messagingSenderId ||
    OPTIMIS_DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId:
    env.VITE_FIREBASE_APP_ID ||
    baseConfig.appId ||
    OPTIMIS_DEFAULT_FIREBASE_CONFIG.appId,
  measurementId:
    env.VITE_FIREBASE_MEASUREMENT_ID ||
    baseConfig.measurementId ||
    OPTIMIS_DEFAULT_FIREBASE_CONFIG.measurementId,
  firestoreDatabaseId: resolvedDatabaseId,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Secondary Firebase App instance khusus untuk mendaftarkan/menyinkronkan akun OPD ke Firebase Authentication
// tanpa mengubah atau memutus sesi login Admin pada instance auth utama.
const provisionerApp = initializeApp(firebaseConfig, 'OptimisUserProvisioner');
const provisionerAuth = getAuth(provisionerApp);
void setPersistence(provisionerAuth, inMemoryPersistence).catch(() => {
  // ignore persistence error
});

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
};
export type { User };

/**
 * Normalisasi password untuk Firebase Auth (minimal 6 karakter sesuai ketentuan Firebase Auth)
 */
export function normalizeFirebaseAuthPassword(rawPassword: string): string {
  const clean = rawPassword.trim();
  if (clean.length >= 6) return clean;
  return `${clean}123456`.slice(0, 6);
}

/**
 * Daftarkan atau sinkronkan akun [namaopd]@oppkpke.com ke Firebase Authentication menggunakan Secondary Auth Provisioner
 * sehingga akun langsung muncul di Firebase Console > Authentication > Users tanpa memutus sesi Admin.
 */
export async function provisionFirebaseEmailAccount(
  email: string,
  rawPassword: string
): Promise<{
  status: 'created' | 'exists' | 'failed';
  email: string;
  error?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const fbPassword = normalizeFirebaseAuthPassword(rawPassword);
  try {
    await createUserWithEmailAndPassword(
      provisionerAuth,
      cleanEmail,
      fbPassword
    );
    await signOut(provisionerAuth).catch(() => {});
    return { status: 'created', email: cleanEmail };
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    const msg = err instanceof Error ? err.message : String(err);

    if (
      code === 'auth/email-already-in-use' ||
      msg.includes('email-already-in-use')
    ) {
      return { status: 'exists', email: cleanEmail };
    }

    // Jika terkena rate limit sementara dari Firebase Auth, tunggu sejenak lalu coba sekali lagi
    if (
      code === 'auth/too-many-requests' ||
      msg.includes('too-many-requests')
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      try {
        await createUserWithEmailAndPassword(
          provisionerAuth,
          cleanEmail,
          fbPassword
        );
        await signOut(provisionerAuth).catch(() => {});
        return { status: 'created', email: cleanEmail };
      } catch (retryErr: unknown) {
        const retryMsg =
          retryErr instanceof Error ? retryErr.message : String(retryErr);
        if (retryMsg.includes('email-already-in-use')) {
          return { status: 'exists', email: cleanEmail };
        }
        return { status: 'failed', email: cleanEmail, error: retryMsg };
      }
    }

    return { status: 'failed', email: cleanEmail, error: msg };
  }
}

/**
 * Login atau daftarkan akun [namaopd]@oppkpke.com ke Firebase Authentication secara otomatis
 */
export async function syncFirebaseEmailAuth(
  email: string,
  rawPassword: string
): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  const fbPassword = normalizeFirebaseAuthPassword(rawPassword);
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, fbPassword);
    return cred.user;
  } catch {
    try {
      const created = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        fbPassword
      );
      return created.user;
    } catch {
      try {
        if (!auth.currentUser) {
          const anon = await signInAnonymously(auth);
          return anon.user;
        }
      } catch {
        // ignore if anonymous auth is not enabled
      }
      return auth.currentUser;
    }
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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.warn(
        'Firestore connection notice: pastikan Cloud Firestore sudah aktif pada project ' +
          firebaseConfig.projectId
      );
    }
  }
}

void testConnection();
