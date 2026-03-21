import { onRequest } from "firebase-functions/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { setCors, verifyToken, requireAdmin } from "./helpers";

// ── GET /apiMe ─────────────────────────────────────────────────────────────
// Returns the authenticated user's profile (merged from Auth + Firestore).
export const apiMe = onRequest(async (req, res) => {
  if (setCors(req, res)) return;  logger.info("[apiMe] →", { method: req.method });  if (req.method !== "GET") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  // Merge any extra fields stored in Firestore (phone, custom displayName, etc.)
  let extra: Record<string, unknown> = {};
  try {
    const snap = await admin.firestore().doc(`users/${decoded.uid}`).get();
    if (snap.exists) extra = snap.data() as Record<string, unknown>;
    logger.debug("[apiMe] Firestore user doc loaded", { uid: decoded.uid, hasExtra: snap.exists });
  } catch (err) {
    logger.warn("[apiMe] Failed to load Firestore user doc", { uid: decoded.uid, error: err });
  }

  res.json({
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: (extra.displayName as string) ?? decoded.name ?? null,
    phone: (extra.phone as string) ?? decoded.phone_number ?? null,
    photoURL: (extra.photoURL as string) ?? decoded.picture ?? null,
    emailVerified: decoded.email_verified ?? false,
    isAdmin: (decoded["isAdmin"] as boolean) ?? false,
    isGuest: decoded.firebase?.sign_in_provider === "anonymous",
  });
});

// ── POST /apiUpdateProfile ─────────────────────────────────────────────────
// Update displayName, photoURL, and/or phone for the authenticated user.
// displayName and photoURL are written to Firebase Auth; phone is stored
// in Firestore (Admin SDK phone updates do not require SMS OTP).
export const apiUpdateProfile = onRequest(async (req, res) => {
  if (setCors(req, res)) return;  logger.info("[apiUpdateProfile] →", { method: req.method, fields: Object.keys(req.body ?? {}) });  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;

  const { displayName, phone, photoURL } =
    req.body as { displayName?: string; phone?: string; photoURL?: string };

  // --- Firebase Auth update ---
  const authUpdate: { displayName?: string; photoURL?: string; phoneNumber?: string } = {};
  if (displayName !== undefined) authUpdate.displayName = displayName;
  if (photoURL !== undefined) authUpdate.photoURL = photoURL;
  // phoneNumber via Admin SDK must be in E.164 format, e.g. +919876543210
  if (phone !== undefined && /^\+[1-9]\d{6,14}$/.test(phone)) {
    authUpdate.phoneNumber = phone;
  }

  try {
    if (Object.keys(authUpdate).length > 0) {
      await admin.auth().updateUser(decoded.uid, authUpdate);
      logger.info("[apiUpdateProfile] Auth record updated", { uid: decoded.uid, fields: Object.keys(authUpdate) });
    }
  } catch (err) {
    logger.warn("[apiUpdateProfile] Auth updateUser failed, continuing to Firestore", { uid: decoded.uid, error: err });
  }

  // --- Firestore user doc update ---
  const fsUpdate: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (displayName !== undefined) fsUpdate.displayName = displayName;
  if (phone !== undefined) fsUpdate.phone = phone;
  if (photoURL !== undefined) fsUpdate.photoURL = photoURL;

  await admin.firestore().doc(`users/${decoded.uid}`).set(fsUpdate, { merge: true });
  logger.info("[apiUpdateProfile] Profile updated", { uid: decoded.uid, fields: Object.keys(fsUpdate) });
  res.json({ success: true });
});

// ── POST /apiSetAdminClaim ──────────────────────────────────────────────────
// Grant or revoke the isAdmin custom claim for a user.
// Only existing admins can call this endpoint.
// Body: { targetUid: string, isAdmin: boolean }
export const apiSetAdminClaim = onRequest(async (req, res) => {
  if (setCors(req, res)) return;  logger.info("[apiSetAdminClaim] →", { method: req.method, targetUid: req.body?.targetUid, isAdmin: req.body?.isAdmin });  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const decoded = await verifyToken(req, res);
  if (!decoded) return;
  if (!requireAdmin(decoded, res)) return;

  const { targetUid, isAdmin } =
    req.body as { targetUid?: string; isAdmin?: boolean };

  if (!targetUid) {
    res.status(400).json({ error: "targetUid is required." });
    return;
  }

  try {
    await admin.auth().setCustomUserClaims(targetUid, { isAdmin: Boolean(isAdmin) });
    await admin.firestore().doc(`users/${targetUid}`).set(
      { isAdmin: Boolean(isAdmin), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    logger.info(`Admin claim ${isAdmin ? "granted" : "revoked"} for ${targetUid} by ${decoded.uid}`);
    res.json({ success: true });
  } catch (err) {
    logger.error("setAdminClaim error", err);
    res.status(500).json({ error: "Failed to set admin claim." });
  }
});
