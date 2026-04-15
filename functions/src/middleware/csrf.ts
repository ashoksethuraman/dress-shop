import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import type {Request, Response, NextFunction} from "express";
import {ALLOWED_ORIGINS} from "./cors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Routes that bootstrap a new session — no CSRF token exists yet
const CSRF_BYPASS_PATHS = new Set(["/users/login", "/users/signup"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || CSRF_BYPASS_PATHS.has(req.path)) {
    next();
    return;
  }

  const origin = req.headers.origin;

  // Layer 1: Origin check
  if (origin !== undefined && !ALLOWED_ORIGINS.includes(origin)) {
    logger.warn("[CSRF] Blocked: Origin not in allowlist", {origin, method: req.method, path: req.path});
    res.status(403).json({error: "Forbidden: cross-site request blocked."});
    return;
  }

  // Layer 2: Double-submit cookie
  const csrfCookie = (req.cookies as Record<string, string | undefined>)["XSRF-TOKEN"] ?? "";
  const csrfHeader = (req.headers["x-csrf-token"] as string | undefined) ?? "";

  if (!csrfCookie || !csrfHeader) {
    logger.warn("[CSRF] Blocked: Missing CSRF token", {
      method: req.method, path: req.path,
      hasCookie: !!csrfCookie, hasHeader: !!csrfHeader,
    });
    res.status(403).json({error: "Forbidden: CSRF token missing."});
    return;
  }

  const cookieBuf = Buffer.from(csrfCookie);
  const headerBuf = Buffer.from(csrfHeader);
  if (
    cookieBuf.length !== headerBuf.length ||
    !crypto.timingSafeEqual(cookieBuf, headerBuf)
  ) {
    logger.warn("[CSRF] Blocked: Token mismatch", {method: req.method, path: req.path});
    res.status(403).json({error: "Forbidden: invalid CSRF token."});
    return;
  }

  next();
}
