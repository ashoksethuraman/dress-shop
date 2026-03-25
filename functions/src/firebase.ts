/**
 * firebase.ts — Admin SDK bootstrap.
 *
 * Imported FIRST by index.ts so emulator overrides are set before any other
 * module calls admin.firestore() / admin.auth().
 * Node module‑caching ensures this runs exactly once.
 */

import * as admin from "firebase-admin";

// Point the Admin SDK at the local emulators when running in the emulator suite.
// FIRESTORE_EMULATOR_HOST is force‑set here because the Functions emulator
// auto‑sets it to the default port (8080) but we use 8081 to avoid conflicts.
if (process.env.FUNCTIONS_EMULATOR === "true") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST     = "127.0.0.1:8081";
}

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { admin };
export const db   = admin.firestore();
export const auth = admin.auth();
