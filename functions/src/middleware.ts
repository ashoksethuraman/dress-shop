import type { Request, Response, NextFunction } from "express";
import * as logger from "firebase-functions/logger";
import { auth } from "./firebase";
import type { ValidationResult } from "./schemas";


declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: import("firebase-admin/auth").DecodedIdToken | null;
    }
  }
}


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
    req.user = null;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || (user["isAdmin"] !== true && user["role"] !== "admin")) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

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
