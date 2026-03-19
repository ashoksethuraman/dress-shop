// firebaseClient.ts
// Initializes Firebase app if REACT_APP_FIREBASE_* env vars are provided.
// Exports `app`, `auth`, and `db` when initialized or `null` otherwise.
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function initFirebase() {
  // read config from environment (create .env with REACT_APP_FIREBASE_*)
  const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;
  const authDomain = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    // Not configured — keep fallback in-memory behavior
    return { app: null, auth: null, db: null };
  }

  if (getApps().length === 0) {
    app = initializeApp({
      apiKey,
      authDomain,
      projectId,
    });
    auth = getAuth(app);
    db = getFirestore(app);
  }

  return { app, auth, db };
}

export function getFirebaseAuth() {
  return auth;
}

export function getFirestoreDb() {
  return db;
}
