import { Request, Response } from "express";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

/** Allow requests from the dev server and deployed Firebase Hosting domains. */
export function setCors(req: Request, res: Response): boolean {
  const allowed = [
    "http://localhost:3000",
    `https://${process.env.GCLOUD_PROJECT}.web.app`,
    `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
  ];
  const origin = req.headers.origin ?? "";
  logger.debug("[CORS] request", { method: req.method, origin: origin || "(none)", url: req.url });
  if (allowed.includes(origin) || origin === "") {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else {
    logger.warn("[CORS] origin not in allowlist — response may be blocked by browser", { origin });
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

/**
 * Verifies the Firebase ID token in the Authorization header.
 * Returns the decoded token or responds with 401 and returns null.
 */
export async function verifyToken(
  req: Request,
  res: Response
): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    logger.warn("[verifyToken] Missing or malformed Authorization header", { url: req.url });
    res.status(401).json({ error: "Missing or malformed Authorization header." });
    return null;
  }
  const idToken = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    logger.debug("[verifyToken] Token verified", { uid: decoded.uid, isAdmin: decoded["isAdmin"] ?? false });
    return decoded;
  } catch (err) {
    logger.warn("[verifyToken] Token verification failed", { url: req.url, error: err });
    res.status(401).json({ error: "Invalid or expired token." });
    return null;
  }
}

/**
 * Tries to decode the Firebase ID token if present.
 * Returns null (without sending a response) if the header is missing or invalid.
 * Use this for endpoints that work for both authenticated and guest users.
 */
export async function optionalToken(
  req: Request
): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    logger.debug("[optionalToken] Token verified", { uid: decoded.uid });
    return decoded;
  } catch (err) {
    logger.debug("[optionalToken] Token invalid or expired — treating as guest", { error: err });
    return null; // expired / invalid — treat as guest
  }
}

/**
 * Checks the `isAdmin` custom claim on the decoded token.
 * Responds with 403 and returns false if the user is not an admin.
 */
export function requireAdmin(
  decoded: admin.auth.DecodedIdToken,
  res: Response
): boolean {
  const isAdmin = decoded["isAdmin"] === true || decoded["role"] === "admin";
  if (!isAdmin) {
    logger.warn("[requireAdmin] Access denied — user is not an admin", { uid: decoded.uid });
    res.status(403).json({ error: "Admin access required." });
    return false;
  }
  logger.debug("[requireAdmin] Admin access granted", { uid: decoded.uid });
  return true;
}
