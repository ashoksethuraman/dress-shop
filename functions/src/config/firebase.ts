import * as admin from "firebase-admin";

if (process.env.FUNCTIONS_EMULATOR === "true") {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";
}

const resolvedStorageBucket =
  process.env.GCS_BUCKET ??
  (process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : undefined);

if (admin.apps.length === 0) {
  const appOptions: admin.AppOptions = {};
  if (resolvedStorageBucket) {
    appOptions.storageBucket = resolvedStorageBucket;
  }
  admin.initializeApp(appOptions);
}

export {admin};
export const db = admin.firestore();
