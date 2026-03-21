/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import * as admin from "firebase-admin";

// ── Global config ──────────────────────────────────────────────────────────
setGlobalOptions({ maxInstances: 10, region: "asia-south1" });

// When running in the Functions emulator, point the Admin SDK at BOTH the Auth
// and Firestore emulators.  These MUST be set before admin.initializeApp().
// IMPORTANT: always force-override FIRESTORE_EMULATOR_HOST — the Functions
// emulator auto-sets it to localhost:8080 (default port), but we use 8081 to
// avoid conflicts.  The conditional guard would leave the wrong port in place.
if (process.env.FUNCTIONS_EMULATOR === "true") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST     = "127.0.0.1:8081";
}

// Initialise Firebase Admin SDK once (Application Default Credentials in Cloud)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ── Export all function groups ─────────────────────────────────────────────
export { apiMe, apiUpdateProfile, apiSetAdminClaim } from "./users";
export { apiGetProducts, apiGetProductById, apiAddProduct, apiUpdateProduct, apiDeleteProduct } from "./products";
export { apiCreateOrder, apiGetMyOrders, apiGetAllOrders, apiGetOrderById, apiUpdateOrderStatus, apiTrackOrder } from "./orders";
export { apiVerifyPayment, apiFailPayment, apiCreateRazorpayOrder, apiRecordPayment } from "./payments";
export { apiUploadLocalImage } from "./images";
