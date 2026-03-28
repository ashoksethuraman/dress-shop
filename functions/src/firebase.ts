import * as admin from "firebase-admin";

if (process.env.FUNCTIONS_EMULATOR === "true") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";
}

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export {admin};
export const db = admin.firestore();
export const auth = admin.auth();
