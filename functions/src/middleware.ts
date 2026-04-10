import type {Request, Response, NextFunction} from "express";
import * as logger from "firebase-functions/logger";
import * as jwt from "jsonwebtoken";
import type {ValidationResult} from "./schemas";

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
  if (ALLOWED_ORIGINS.includes(origin) || origin === "") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else {
    logger.warn("[CORS] origin not in allowlist — response may be blocked by browser", {origin});
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
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
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    res.status(401).json({error: "Missing or malformed Authorization header."});
    return;
  }
  const decoded = verifyJwt(header.slice(7));
  if (!decoded) {
    res.status(401).json({error: "Invalid or expired token."});
    return;
  }
  req.user = decoded;
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) {
    req.user = verifyJwt(header.slice(7));
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
