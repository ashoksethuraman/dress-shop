import {Router, type Request, type Response} from "express";
import {FieldValue} from "firebase-admin/firestore";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import * as logger from "firebase-functions/logger";
import {db} from "../firebase";
import {authenticate, requireAdmin, validate} from "../middleware";
import {
  type UpdateProfileBody,
  type SetAdminClaimBody,
  type SignupBody,
  type LoginBody,
  validateUpdateProfile,
  validateSetAdminClaim,
  validateSignup,
  validateLogin,
  validateBulkStatusUpdate,
} from "../schemas";

export const usersRouter = Router();

const BCRYPT_SALT_ROUNDS = 12;

function issueJwt(payload: {userId: string; username: string; email: string; role: string}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set.");
  return jwt.sign(payload, secret, {algorithm: "HS256", expiresIn: "1h"});
}


usersRouter.post(
  "/signup",
  validate(validateSignup),
  async (req: Request, res: Response) => {
    const {username, email, password, age, gender, mobileNumber, address} = req.body as SignupBody;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!existing.empty) {
      res.status(409).json({error: "An account with this email already exists.", field: "email"});
      return;
    }

    const uid = crypto.randomUUID();

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    await db.doc(`users/${uid}`).set({
      id: uid,
      username: username.trim(),
      email: normalizedEmail,
      passwordHash,
      age,
      gender,
      mobileNumber: mobileNumber.trim(),
      address: address?.trim() ?? null,
      role: "user",
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    let token: string;
    try {
      token = issueJwt({userId: uid, username: username.trim(), email: normalizedEmail, role: "user"});
    } catch (err) {
      logger.error("[POST /users/signup] JWT issue failed", {error: err});
      res.status(500).json({error: "Internal server error."});
      return;
    }

    res.cookie("__session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600 * 1000,
    });

    logger.info("[POST /users/signup] User created", {uid, email: normalizedEmail});

    res.status(201).json({
      success: true,
      token,
      user: {uid, username: username.trim(), email: normalizedEmail, role: "user"},
    });
  }
);


usersRouter.post(
  "/login",
  validate(validateLogin),
  async (req: Request, res: Response) => {
    const {email, password} = req.body as LoginBody;
    const normalizedEmail = email.toLowerCase().trim();

    const snapshot = await db.collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    const userDoc = snapshot.empty ? null : snapshot.docs[0];
    const userData = userDoc?.data();
    const storedHash = userData?.passwordHash as string | undefined;

    if (!storedHash) {
      res.status(401).json({error: "Invalid email or password."});
      return;
    }

    const match = await bcrypt.compare(password, storedHash);
    if (!match) {
      logger.warn("[POST /users/login] Failed login attempt", {email: normalizedEmail});
      res.status(401).json({error: "Invalid email or password."});
      return;
    }

    if (userData!.isActive === false) {
      logger.warn("[POST /users/login] Blocked inactive account", {email: normalizedEmail});
      res.status(403).json({error: "Your account has been deactivated. Please contact support."});
      return;
    }

    const uid = userData!.id as string;
    const username = userData!.username as string ?? null;
    const role = userData!.role as string ?? "user";

    let token: string;
    try {
      token = issueJwt({userId: uid, username, email: normalizedEmail, role});
    } catch (err) {
      logger.error("[POST /users/login] JWT issue failed", {error: err});
      res.status(500).json({error: "Internal server error."});
      return;
    }

    res.cookie("__session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600 * 1000,
    });

    logger.info("[POST /users/login] Successful login", {uid, email: normalizedEmail});

    res.json({
      success: true,
      token,
      user: {uid, username, email: normalizedEmail, role},
    });
  }
);

usersRouter.get("/me", authenticate, async (req: Request, res: Response) => {
  const decoded = req.user!;

  let extra: Record<string, unknown> = {};
  try {
    const snap = await db.doc(`users/${decoded.uid}`).get();
    if (snap.exists) extra = snap.data() as Record<string, unknown>;
  } catch (err) {
    logger.warn("[GET /users/me] Failed to load Firestore user doc", {uid: decoded.uid, error: err});
  }

  res.json({
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: (extra.username as string) ?? decoded.name ?? null,
    username: (extra.username as string) ?? decoded.name ?? null,
    age: (extra.age as number) ?? null,
    gender: (extra.gender as string) ?? null,
    mobileNumber: (extra.mobileNumber as string) ?? null,
    address: (extra.address as string) ?? null,
    phone: (extra.mobileNumber as string) ?? null,
    photoURL: (extra.photoURL as string) ?? null,
    role: decoded.role ?? "user",
    isAdmin: decoded.role === "admin",
    isGuest: false,
  });
});

usersRouter.post(
  "/update-profile",
  authenticate,
  validate(validateUpdateProfile),
  async (req: Request, res: Response) => {
    const {displayName, phone, photoURL} = req.body as UpdateProfileBody;
    const uid = req.user!.uid;

    const fsUpdate: Record<string, unknown> = {updatedAt: FieldValue.serverTimestamp()};
    if (displayName !== undefined) fsUpdate.displayName = displayName;
    if (phone !== undefined) fsUpdate.phone = phone;
    if (photoURL !== undefined) fsUpdate.photoURL = photoURL;

    try {
      await db.doc(`users/${uid}`).set(fsUpdate, {merge: true});
      logger.info("[POST /users/update-profile] Profile updated", {uid, fields: Object.keys(fsUpdate)});
      res.json({success: true});
    } catch (err) {
      logger.error("[POST /users/update-profile] Firestore error", {uid, error: err});
      res.status(500).json({error: "Failed to update profile."});
    }
  }
);

usersRouter.post(
  "/set-admin",
  authenticate,
  requireAdmin,
  validate(validateSetAdminClaim),
  async (req: Request, res: Response) => {
    const {targetUid, isAdmin} = req.body as SetAdminClaimBody;

    try {
      await db.doc(`users/${targetUid}`).set(
        {role: isAdmin ? "admin" : "user", isAdmin: Boolean(isAdmin), updatedAt: FieldValue.serverTimestamp()},
        {merge: true}
      );
      logger.info(
        `[POST /users/set-admin] isAdmin=${isAdmin} set for ${targetUid} by ${req.user!.uid}`
      );
      res.json({success: true});
    } catch (err) {
      logger.error("[POST /users/set-admin] error", {targetUid, error: err});
      res.status(500).json({error: "Failed to set admin claim."});
    }
  }
);


usersRouter.get("/wishlist", authenticate, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  try {
    const snap = await db.doc(`users/${uid}`).get();
    const wishlist: string[] = snap.exists ? ((snap.data()?.wishlist as string[]) ?? []) : [];
    res.json({wishlist});
  } catch (err) {
    logger.error("[GET /users/wishlist] error", {uid, error: err});
    res.status(500).json({error: "Failed to fetch wishlist."});
  }
});


usersRouter.put("/wishlist", authenticate, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  const {wishlist} = req.body as {wishlist: string[]};
  if (!Array.isArray(wishlist)) {
    res.status(400).json({error: "wishlist must be an array of productId strings."});
    return;
  }
  const sanitized = wishlist.filter((id) => typeof id === "string" && id.length > 0).slice(0, 500);
  try {
    await db.doc(`users/${uid}`).set({wishlist: sanitized, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    res.json({success: true, wishlist: sanitized});
  } catch (err) {
    logger.error("[PUT /users/wishlist] error", {uid, error: err});
    res.status(500).json({error: "Failed to save wishlist."});
  }
});


usersRouter.get("/cart", authenticate, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  try {
    const snap = await db.doc(`users/${uid}`).get();
    const cart: Array<{productId: string; qty: number; size?: string | null}> =
      snap.exists ? ((snap.data()?.cart as Array<{productId: string; qty: number; size?: string | null}>) ?? []) : [];
    res.json({cart});
  } catch (err) {
    logger.error("[GET /users/cart] error", {uid, error: err});
    res.status(500).json({error: "Failed to fetch cart."});
  }
});


usersRouter.put("/cart", authenticate, async (req: Request, res: Response) => {
  const uid = req.user!.uid;
  const {cart} = req.body as {cart: Array<{productId: string; qty: number; size?: string | null}>};
  if (!Array.isArray(cart)) {
    res.status(400).json({error: "cart must be an array."});
    return;
  }
  const sanitized = cart
    .filter((item) => typeof item.productId === "string" && item.productId.length > 0 && Number.isInteger(item.qty) && item.qty > 0)
    .map(({productId, qty, size}) => ({productId, qty, size: size ?? null}))
    .slice(0, 200);
  try {
    await db.doc(`users/${uid}`).set({cart: sanitized, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    res.json({success: true, cart: sanitized});
  } catch (err) {
    logger.error("[PUT /users/cart] error", {uid, error: err});
    res.status(500).json({error: "Failed to save cart."});
  }
});


// ── Admin: list all registered users ─────────────────────────────────────────
usersRouter.get(
  "/all",
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const snap = await db.collection("users").orderBy("createdAt", "desc").limit(500).get();
      const users = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: d.id as string,
          username: (d.username as string) ?? null,
          email: (d.email as string) ?? null,
          role: (d.role as string) ?? "user",
          isActive: d.isActive !== false, // default true for legacy docs
          createdAt: d.createdAt ? (d.createdAt as {toDate: () => Date}).toDate().toISOString() : null,
        };
      });
      res.json({users});
    } catch (err) {
      logger.error("[GET /users/all] error", {error: err});
      res.status(500).json({error: "Failed to fetch users."});
    }
  }
);


// ── Admin: bulk update isActive status ───────────────────────────────────────
usersRouter.patch(
  "/status",
  authenticate,
  requireAdmin,
  validate(validateBulkStatusUpdate),
  async (req: Request, res: Response) => {
    const {uids, isActive} = req.body as {uids: string[]; isActive: boolean};

    // Prevent admin from deactivating themselves
    const requestingUid = req.user!.uid;
    if (!isActive && uids.includes(requestingUid)) {
      res.status(400).json({error: "You cannot deactivate your own account."});
      return;
    }

    try {
      const batch = db.batch();
      for (const uid of uids) {
        batch.update(db.doc(`users/${uid}`), {
          isActive,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      logger.info("[PATCH /users/status] Bulk status update", {
        count: uids.length,
        isActive,
        by: requestingUid,
      });
      res.json({success: true, updated: uids.length});
    } catch (err) {
      logger.error("[PATCH /users/status] error", {error: err});
      res.status(500).json({error: "Failed to update user status."});
    }
  }
);
