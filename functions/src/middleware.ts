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

/* =========================================================
   CORS
========================================================= */

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://halleycomet.in",
  "https://www.halleycomet.in",
  "https://halleycomet-7cd48.web.app",
  "https://halleycomet-7cd48.firebaseapp.com",
  `https://${process.env.GCLOUD_PROJECT}.web.app`,
  `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
];

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? "";

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    logger.warn("[CORS] origin not in allowlist", {origin});
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Requested-With,X-CSRF-Token");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}

/* =========================================================
   COOKIE HELPERS
========================================================= */

const IS_PROD = process.env.NODE_ENV === "production";

function cookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    secure: IS_PROD,
    // Use "lax" for same-origin (Firebase Hosting rewrites make this same-origin)
    // This is more secure than "none" and works perfectly with same-domain setup
    sameSite: "lax" as const,
    maxAge: 3600 * 1000,
    path: "/",
  };
}

export function setAuthCookies(res: Response, sessionJwt: string): void {
  res.cookie("__session", sessionJwt, cookieOptions(true));
  // res.cookie("XSRF-TOKEN", csrfToken, cookieOptions(false));
}

export function clearAuthCookies(res: Response): void {
  const base = {
    path: "/",
    maxAge: 0,
    httpOnly: false,
    secure: IS_PROD,
    sameSite: IS_PROD ? ("none" as const) : ("lax" as const),
  };

  res.cookie("__session", "", {...base, httpOnly: true});
  res.cookie("XSRF-TOKEN", "", base);
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/* =========================================================
   CSRF PROTECTION (FIXED)
========================================================= */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_BYPASS_PATHS = new Set(["/users/login", "/users/signup"]);

/* =========================================================
   BROWSER-ONLY VALIDATION (Block Postman/curl)
========================================================= */

export function browserOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip for safe methods
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin ?? "";
  const referer = req.headers.referer ?? "";
  const userAgent = req.headers["user-agent"] ?? "";

  // 1. MUST have an Origin header (browsers always send this for POST/PUT/PATCH/DELETE)
  if (!origin) {
    logger.warn("[BROWSER-ONLY] Blocked: No Origin header", {
      method: req.method,
      path: req.path,
      userAgent,
    });
    res.status(403).json({error: "Forbidden: cross-origin requests from non-browser clients not allowed."});
    return;
  }

  // 2. MUST have a Referer header (browsers always send for same-origin requests)
  if (!referer) {
    logger.warn("[BROWSER-ONLY] Blocked: No Referer header", {
      method: req.method,
      path: req.path,
      origin,
    });
    res.status(403).json({error: "Forbidden: requests must originate from a browser."});
    return;
  }

  // 3. Origin must be in allowlist (extra safety)
  if (!ALLOWED_ORIGINS.includes(origin)) {
    logger.warn("[BROWSER-ONLY] Blocked: Origin not allowed", {
      origin,
      path: req.path,
    });
    res.status(403).json({error: "Forbidden: origin not allowed."});
    return;
  }

  // 4. (Optional) Reject obvious non-browser user agents
  const isSuspiciousUA =
    userAgent.includes("Postman") ||
    userAgent.includes("curl") ||
    userAgent.includes("Thunder Client") ||
    userAgent.includes("Insomnia") ||
    userAgent.includes("RestClient") ||
    userAgent === "" ||
    (userAgent.length < 10 && !userAgent.includes("Mozilla"));

  if (isSuspiciousUA) {
    logger.warn("[BROWSER-ONLY] Blocked: Suspicious user agent", {
      userAgent,
      path: req.path,
    });
    res.status(403).json({error: "Forbidden: non-browser clients not allowed."});
    return;
  }

  next();
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || CSRF_BYPASS_PATHS.has(req.path)) {
    next();
    return;
  }

  const origin = req.headers.origin;

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    logger.warn("[CSRF] Blocked origin", {origin});
    res.status(403).json({error: "Forbidden: cross-site request blocked."});
    return;
  }

  const csrfCookie = (req.cookies as Record<string, string | undefined>)["XSRF-TOKEN"] ?? "";
  const csrfHeader = (req.headers["x-csrf-token"] as string | undefined)?.trim() ?? "";

  if (!csrfCookie || !csrfHeader) {
    logger.warn("[CSRF] Missing token", {
      method: req.method,
      path: req.path,
    });

    res.status(403).json({error: "Forbidden: CSRF token missing."});
    return;
  }

  const cookieBuf = Buffer.from(csrfCookie, "utf8");
  const headerBuf = Buffer.from(csrfHeader, "utf8");

  if (
    cookieBuf.length !== headerBuf.length ||
    !crypto.timingSafeEqual(cookieBuf, headerBuf)
  ) {
    logger.warn("[CSRF] Token mismatch", {
      method: req.method,
      path: req.path,
    });

    res.status(403).json({error: "Forbidden: invalid CSRF token."});
    return;
  }

  next();
}

/* =========================================================
   JWT
========================================================= */

function verifyJwt(token: string): AuthUserPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      userId: string;
      username: string;
      email: string;
      role: string;
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

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Read session cookie or Authorization header
  const sessionCookie =
    (req.cookies as Record<string, string | undefined>)["__session"];
  const header = req.headers.authorization ?? "";
  const token = sessionCookie ?? (header.startsWith("Bearer ") ? header.slice(7) : null);

  if (!token) {
    logger.warn("[AUTH] No token provided", {path: req.path});
    res.status(401).json({error: "Authentication required."});
    return;
  }

  const decoded = verifyJwt(token);
  if (!decoded) {
    logger.warn("[AUTH] Invalid or expired token", {path: req.path});
    res.status(401).json({error: "Invalid or expired token."});
    return;
  }

  req.user = decoded;
  logger.debug("[AUTH] User authenticated", {uid: decoded.uid, role: decoded.role});
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const sessionCookie =
    (req.cookies as Record<string, string | undefined>)["__session"];

  const header = req.headers.authorization ?? "";
  const token =
    sessionCookie ?? (header.startsWith("Bearer ") ? header.slice(7) : null);

  req.user = token ? verifyJwt(token) : null;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    logger.warn("[requireAdmin] Access denied", {
      uid: req.user?.uid,
      role: req.user?.role,
      path: req.path,
    });
    res.status(403).json({error: "Admin access required."});
    return;
  }
  next();
}
/* =========================================================
   VALIDATION
========================================================= */

export function validate(
  fn: (body: unknown) => ValidationResult
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const result = fn(req.body);

    if (!result.valid) {
      res.status(400).json({
        error: result.error,
        field: result.field,
      });
      return;
    }

    next();
  };
}

/* =========================================================
   PARAM SANITIZER
========================================================= */

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
