/**
 * One-time script to grant isAdmin custom claim to a Firebase user.
 *
 * Usage:
 *   node scripts/setAdmin.js <userEmail>
 *
 * Example:
 *   node scripts/setAdmin.js ashok@example.com
 *
 * Prerequisites:
 *   - Download your Firebase service account key:
 *     Firebase Console → Project Settings → Service accounts → Generate new private key
 *     Save it as scripts/serviceAccountKey.json  (NEVER commit this file)
 */

const admin = require('../functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/setAdmin.js <userEmail>');
  process.exit(1);
}

async function setAdmin() {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
    console.log(`✅ Admin claim granted to: ${email} (uid: ${user.uid})`);
    console.log('   The user must sign out and sign back in for the claim to take effect.');
  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    process.exit(0);
  }
}

setAdmin();
