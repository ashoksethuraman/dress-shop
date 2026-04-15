import * as logger from "firebase-functions/logger";
import type {Request, Response, NextFunction} from "express";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  `https://${process.env.GCLOUD_PROJECT}.web.app`,
  `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
];

export {ALLOWED_ORIGINS};

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else if (origin === "") {
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
