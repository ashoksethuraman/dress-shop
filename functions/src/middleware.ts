import * as crypto from "crypto";
import type {Request, Response, NextFunction} from "express";
import * as logger from "firebase-functions/logger";
import * as jwt from "jsonwebtoken";
import type {ValidationResult} from "./types";

/** Authenticated user payload extracted from a verified HS256 JWT. */
export interface AuthUserPayload {
  uid: string;
  email: string;
  name: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUserPayload | null;
    }
  }
}


const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  // Firebase Hosting domains — GCLOUD_PROJECT is set by the Functions runtime
  `https://${process.env.GCLOUD_PROJECT}.web.app`,
  `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (origin === "") {
    // Server-to-server: no Origin header, allow without credentials
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    logger.warn("[CORS] origin not in allowlist — response may be blocked by browser", {origin});
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Requested-With,X-CSRF-Token");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Auth cookie options:
 * - Production:  Secure + SameSite=None  (cross-origin between hosting domain and
 *                cloudfunctions.net — both are served over HTTPS)
 * - Development: Secure=false + SameSite=Lax  (localhost emulator, HTTP)
 */
function cookieOptions(httpOnly: boolean): {
  httpOnly: boolean; secure: boolean;
  sameSite: "none" | "lax"; maxAge: number; path: string;
} {
  return {
    httpOnly,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    maxAge: 3600 * 1000, // 1 hour
    path: "/",
  };
}

/** Set both auth cookies after a successful login / signup. */
export function setAuthCookies(res: Response, sessionJwt: string, csrfToken: string): void {
  res.cookie("__session", sessionJwt, cookieOptions(true));
  res.cookie("XSRF-TOKEN", csrfToken, cookieOptions(false)); // readable by JS for double-submit
}

/** Clear both auth cookies on logout. */
export function clearAuthCookies(res: Response): void {
  const base = {path: "/", maxAge: 0, httpOnly: false, secure: IS_PROD, sameSite: IS_PROD ? ("none" as const) : ("lax" as const)};
  res.cookie("__session", "", {...base, httpOnly: true});
  res.cookie("XSRF-TOKEN", "", base);
}

/** Generates a cryptographically secure random CSRF token (hex, 32 bytes). */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Routes that bootstrap a new session — no CSRF token exists yet at that point.
const CSRF_BYPASS_PATHS = new Set(["/users/login", "/users/signup"]);

/**
 * CSRF protection — Double Submit Cookie pattern.
 *
 * For every state-changing request (POST, PUT, PATCH, DELETE):
 *  1. The `Origin` header (when present) must be in ALLOWED_ORIGINS.
 *  2. The `X-CSRF-Token` request header must equal the `XSRF-TOKEN` cookie
 *     value.  An attacker's page cannot read `HttpOnly`-neighbour cookies
 *     cross-origin, so they cannot forge the matching header.
 *
 * Login and signup are exempt — they are the endpoints that *create* the
 * session and CSRF token, so no token exists beforehand.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || CSRF_BYPASS_PATHS.has(req.path)) {
    next();
    return;
  }

  const origin = req.headers.origin;

  // Layer 1 — Origin check: reject unknown cross-site origins outright.
  if (origin !== undefined && !ALLOWED_ORIGINS.includes(origin)) {
    logger.warn("[CSRF] Blocked: Origin not in allowlist", {
      origin, method: req.method, path: req.path,
    });
    res.status(403).json({error: "Forbidden: cross-site request blocked."});
    return;
  }

  // Layer 2 — Double-submit cookie: header must match the XSRF-TOKEN cookie.
  const csrfCookie  = (req.cookies as Record<string, string | undefined>)["XSRF-TOKEN"] ?? "";
  const csrfHeader  = (req.headers["x-csrf-token"] as string | undefined) ?? "";

  if (!csrfCookie || !csrfHeader) {
    logger.warn("[CSRF] Blocked: Missing CSRF token", {
      method: req.method, path: req.path, hasCookie: !!csrfCookie, hasHeader: !!csrfHeader,
    });
    res.status(403).json({error: "Forbidden: CSRF token missing."});
    return;
  }

  // Constant-time comparison to prevent timing attacks.
  const cookieBuf = Buffer.from(csrfCookie);
  const headerBuf = Buffer.from(csrfHeader);
  if (cookieBuf.length !== headerBuf.length ||
      !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
    logger.warn("[CSRF] Blocked: Token mismatch", {method: req.method, path: req.path});
    res.status(403).json({error: "Forbidden: invalid CSRF token."});
    return;
  }

  next();
}

// ── reCAPTCHA v3 ─────────────────────────────────────────────────────────────

const RECAPTCHA_MIN_SCORE = 0.5;

/**
 * Express middleware factory. Verifies the reCAPTCHA v3 token in `req.body.captchaToken`.
 * If RECAPTCHA_SECRET_KEY is not set (dev / CI), the check is skipped.
 */
export function captchaCheck(action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      logger.warn("[captchaCheck] RECAPTCHA_SECRET_KEY not set — skipping (dev mode)");
      next();
      return;
    }

    const token = (req.body as Record<string, unknown>).captchaToken;
    if (typeof token !== "string" || !token) {
      res.status(400).json({error: "CAPTCHA token is required."});
      return;
    }

    try {
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      });
      const data = await verifyRes.json() as {
        success: boolean;
        score?: number;
        action?: string;
        "error-codes"?: string[];
      };

      if (!data.success || (data.score ?? 0) < RECAPTCHA_MIN_SCORE) {
        logger.warn("[captchaCheck] CAPTCHA failed", {action, score: data.score, errors: data["error-codes"]});
        res.status(403).json({error: "CAPTCHA verification failed. Please try again."});
        return;
      }
      if (data.action && data.action !== action) {
        logger.warn("[captchaCheck] Action mismatch", {expected: action, received: data.action});
        res.status(403).json({error: "CAPTCHA verification failed. Please try again."});
        return;
      }
      next();
    } catch (err) {
      // Don't block the request if Google's API is unreachable
      logger.error("[captchaCheck] Verification request failed — allowing through", {error: err});
      next();
    }
  };
}

function verifyJwt(token: string): AuthUserPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      userId: string; username: string; email: string; role: string;
    };
    return {
      uid: payload.userId,
      email: payload.email,
      name: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Primary: HttpOnly __session cookie (browser clients)
  const sessionCookie = (req.cookies as Record<string, string | undefined>)["__session"];
  const token = sessionCookie ?? (() => {
    // Fallback: Authorization header (server-to-server / CLI callers)
    const header = req.headers.authorization ?? "";
    return header.startsWith("Bearer ") ? header.slice(7) : null;
  })();

  if (!token) {
    res.status(401).json({error: "Authentication required."});
    return;
  }
  const decoded = verifyJwt(token);
  if (!decoded) {
    res.status(401).json({error: "Invalid or expired token."});
    return;
  }
  req.user = decoded;
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionCookie = (req.cookies as Record<string, string | undefined>)["__session"];
  const header = req.headers.authorization ?? "";
  const token = sessionCookie ?? (header.startsWith("Bearer ") ? header.slice(7) : null);
  if (token) {
    req.user = verifyJwt(token);
  } else {
    req.user = null;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user || user.role !== "admin") {
    res.status(403).json({error: "Admin access required."});
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
      res.status(400).json({error: result.error, field: result.field});
      return;
    }
    next();
  };
}

/**
 * Rejects requests where any named route parameter looks malformed.
 * Accepts only alphanumeric chars, hyphens, underscores, and dots — max 128 chars.
 * Call as: router.get("/:id", sanitizeParam("id"), ...) 
 */
export function sanitizeParam(...params: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const SAFE_PARAM = /^[\w\-.]{1,128}$/;
    for (const p of params) {
      const v = req.params[p];
      if (!v || !SAFE_PARAM.test(v)) {
        res.status(400).json({error: `Invalid route parameter: ${p}.`});
        return;
      }
    }
    next();
  };
}
