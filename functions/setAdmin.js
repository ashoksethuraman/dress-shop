/**
 * One-time script to grant isAdmin=true to a user in the Auth Emulator.
 * Usage:  node setAdmin.js <email-or-uid>
 *
 * Run from the functions/ directory while the emulator is running.
 */
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST     = "127.0.0.1:8081";

const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "shopping-app-63a1f",
});

const identifier = process.argv[2];
if (!identifier) {
  console.error("Usage: node setAdmin.js <email-or-uid>");
  process.exit(1);
}

async function run() {
  let uid = identifier;

  // If it looks like an email, resolve UID first
  if (identifier.includes("@")) {
    const user = await admin.auth().getUserByEmail(identifier);
    uid = user.uid;
    console.log(`Resolved email → UID: ${uid}`);
  }

  await admin.auth().setCustomUserClaims(uid, { isAdmin: true });
  console.log(`✅  isAdmin=true set for UID: ${uid}`);
  console.log("Sign out and back in inside the app to pick up the new claim.");
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
