import * as jwt from "jsonwebtoken";
import type {Request, Response, NextFunction} from "express";
import type {AuthUserPayload} from "../types";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUserPayload | null;
    }
  }
}

function verifyJwt(token: string): AuthUserPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload & {
      userId: string; username: string; email: string; role: string;
    };
    return {uid: payload.userId, email: payload.email, name: payload.username, role: payload.role};
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const sessionCookie = (req.cookies as Record<string, string | undefined>)["__session"];
  if (sessionCookie) return sessionCookie;
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
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
  const token = extractToken(req);
  req.user = token ? verifyJwt(token) : null;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({error: "Admin access required."});
    return;
  }
  next();
}
