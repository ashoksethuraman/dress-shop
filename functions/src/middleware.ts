/**
 * middleware.ts — Shared Express middleware.
 *
 * • corsMiddleware   — sets CORS headers; handles OPTIONS preflight
 * • authenticate     — requires a valid Firebase ID token → 401 if missing
 * • optionalAuth     — decodes token if present; sets req.user = null for guests
 * • requireAdmin     — must follow authenticate; rejects non‑admins with 403
 * • validate(fn)     — factory that runs a schema validator and returns 400 on failure
 */

import type { Request, Response, NextFunction } from "express";
import * as logger from "firebase-functions/logger";
import { auth } from "./firebase";
import type { ValidationResult } from "./schemas";

// ── Augment Express Request to carry the decoded Firebase token ───────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: import("firebase-admin/auth").DecodedIdToken | null;
    }
  }
}

// ── CORS ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  `https://${process.env.GCLOUD_PROJECT}.web.app`,
  `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin) || origin === "") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else {
    logger.warn("[CORS] origin not in allowlist — response may be blocked by browser", { origin });
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

// ── Auth ──────────────────────────────────────────────────────────────────

/** Requires a valid Bearer token. Sets req.user or responds 401. */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header." });
    return;
  }
  try {
    req.user = await auth.verifyIdToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Decodes a Bearer token when present; sets req.user = null for guests/anonymous.
 * Never rejects the request — use for endpoints that work for both auth and guest users.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    req.user = null;
    next();
    return;
  }
  try {
    req.user = await auth.verifyIdToken(header.slice(7));
  } catch {
    req.user = null; // expired / invalid — treat as guest
  }
  next();
}

/**
 * Must be used AFTER authenticate. Responds 403 if the user does not
 * have the isAdmin custom claim or the "admin" role claim.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || (user["isAdmin"] !== true && user["role"] !== "admin")) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

/**
 * Middleware factory.
 * Runs the provided validator against req.body; responds 400 on failure.
 *
 * Usage:  router.post("/", validate(validateCreateOrder), handler)
 */
export function validate(
  fn: (body: unknown) => ValidationResult
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const result = fn(req.body);
    if (!result.valid) {
      res.status(400).json({ error: result.error, field: result.field });
      return;
    }
    next();
  };
}
