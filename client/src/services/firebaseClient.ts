import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function initFirebase() {
  const apiKey            = process.env.REACT_APP_FIREBASE_API_KEY;
  const authDomain        = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN;
  const projectId         = process.env.REACT_APP_FIREBASE_PROJECT_ID;
  const storageBucket     = process.env.REACT_APP_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID;
  const appId             = process.env.REACT_APP_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId) {
    return { app: null, auth: null };
  }

  if (getApps().length === 0) {
    app  = initializeApp({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId });
    auth = getAuth(app);

    if (process.env.REACT_APP_USE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
  }

  return { app, auth };
}

export function getFirebaseApp() {
  return app;
}

export function getFirebaseAuth() {
  return auth;
}
