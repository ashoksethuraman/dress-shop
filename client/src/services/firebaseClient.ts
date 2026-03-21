// firebaseClient.ts
// Firebase Auth is always initialized when env vars are present.
// Firestore is only initialized when REACT_APP_USE_FIRESTORE=true — set this
// once you have created the Firestore database in the Firebase console.
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function initFirebase() {
  const apiKey            = process.env.REACT_APP_FIREBASE_API_KEY;
  const authDomain        = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN;
  const projectId         = process.env.REACT_APP_FIREBASE_PROJECT_ID;
  const storageBucket     = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID;
  const appId             = process.env.REACT_APP_FIREBASE_APP_ID;
  const useFirestore      = process.env.REACT_APP_USE_FIRESTORE === 'true';

  if (!apiKey || !authDomain || !projectId) {
    // Not configured — keep fallback in-memory behavior
    return { app: null, auth: null, db: null };
  }

  if (getApps().length === 0) {
    app  = initializeApp({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId });
    auth = getAuth(app);
    db   = useFirestore ? getFirestore(app) : null;

    // When running against the local emulator suite, wire up the SDK connections
    if (process.env.REACT_APP_USE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      if (db) connectFirestoreEmulator(db, '127.0.0.1', 8081);
    }
  }

  return { app, auth, db };
}

export function getFirebaseApp() {
  return app;
}

export function getFirebaseAuth() {
  return auth;
}

export function getFirestoreDb() {
  return db;
}
