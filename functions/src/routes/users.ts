import { Router, type Request, type Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { db, auth } from "../firebase";
import { authenticate, requireAdmin, validate } from "../middleware";
import {
  type UpdateProfileBody,
  type SetAdminClaimBody,
  validateUpdateProfile,
  validateSetAdminClaim,
} from "../schemas";

export const usersRouter = Router();

usersRouter.get("/me", authenticate, async (req: Request, res: Response) => {
  const decoded = req.user!;

  let extra: Record<string, unknown> = {};
  try {
    const snap = await db.doc(`users/${decoded.uid}`).get();
    if (snap.exists) extra = snap.data() as Record<string, unknown>;
  } catch (err) {
    logger.warn("[GET /users/me] Failed to load Firestore user doc", { uid: decoded.uid, error: err });
  }

  res.json({
    uid:           decoded.uid,
    email:         decoded.email         ?? null,
    name:          (extra.displayName as string) ?? decoded.name ?? null,
    phone:         (extra.phone as string) ?? decoded.phone_number ?? null,
    photoURL:      (extra.photoURL as string) ?? decoded.picture ?? null,
    emailVerified: decoded.email_verified ?? false,
    isAdmin:       (decoded["isAdmin"] as boolean) ?? false,
    isGuest:       decoded.firebase?.sign_in_provider === "anonymous",
  });
});

usersRouter.post(
  "/update-profile",
  authenticate,
  validate(validateUpdateProfile),
  async (req: Request, res: Response) => {
    const { displayName, phone, photoURL } = req.body as UpdateProfileBody;
    const uid = req.user!.uid;

    const authUpdate: { displayName?: string; photoURL?: string; phoneNumber?: string } = {};
    if (displayName !== undefined) authUpdate.displayName  = displayName;
    if (photoURL    !== undefined) authUpdate.photoURL     = photoURL;
    if (phone       !== undefined) authUpdate.phoneNumber  = phone;

    if (Object.keys(authUpdate).length > 0) {
      try {
        await auth.updateUser(uid, authUpdate);
        logger.info("[POST /users/update-profile] Auth record updated", { uid, fields: Object.keys(authUpdate) });
      } catch (err) {
        logger.warn("[POST /users/update-profile] Auth updateUser failed", { uid, error: err });
      }
    }

    const fsUpdate: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (displayName !== undefined) fsUpdate.displayName = displayName;
    if (phone       !== undefined) fsUpdate.phone       = phone;
    if (photoURL    !== undefined) fsUpdate.photoURL    = photoURL;

    try {
      await db.doc(`users/${uid}`).set(fsUpdate, { merge: true });
      logger.info("[POST /users/update-profile] Profile updated", { uid, fields: Object.keys(fsUpdate) });
      res.json({ success: true });
    } catch (err) {
      logger.error("[POST /users/update-profile] Firestore error", { uid, error: err });
      res.status(500).json({ error: "Failed to update profile." });
    }
  }
);

usersRouter.post(
  "/set-admin",
  authenticate,
  requireAdmin,
  validate(validateSetAdminClaim),
  async (req: Request, res: Response) => {
    const { targetUid, isAdmin } = req.body as SetAdminClaimBody;

    try {
      await auth.setCustomUserClaims(targetUid, { isAdmin: Boolean(isAdmin) });
      await db.doc(`users/${targetUid}`).set(
        { isAdmin: Boolean(isAdmin), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      logger.info(
        `[POST /users/set-admin] isAdmin=${isAdmin} set for ${targetUid} by ${req.user!.uid}`
      );
      res.json({ success: true });
    } catch (err) {
      logger.error("[POST /users/set-admin] error", { targetUid, error: err });
      res.status(500).json({ error: "Failed to set admin claim." });
    }
  }
);
