/**
 * apply-storage-cors.js
 *
 * Applies cors.json to the Firebase Storage bucket using ONLY Node.js
 * built-in modules (https, crypto, fs) — no npm install needed.
 *
 * How it works:
 *   1. Reads serviceAccountKey.json (already in scripts/) for credentials.
 *   2. Builds a signed JWT (RS256) to authenticate as the service account.
 *   3. Exchanges the JWT for a short-lived OAuth2 access token from Google.
 *   4. Calls the Google Cloud Storage JSON API to PATCH the bucket CORS config.
 *   5. GETs the bucket metadata to verify the CORS was applied.
 *
 * Usage (run once from any directory):
 *   node scripts/apply-storage-cors.js
 */

const https  = require("https");
const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

const BUCKET          = "halleycomet-7cd48.firebasestorage.app";
const CORS_SRC        = path.resolve(__dirname, "..", "cors.json");
const SERVICE_ACCOUNT = path.resolve(__dirname, "serviceAccountKey.json");

// ── helpers ──────────────────────────────────────────────────────────────────

function base64url(buf) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** Build and sign a Google service-account JWT (RS256). */
function makeJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.full_control",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  })));
  const signing  = `${header}.${payload}`;
  const sign     = crypto.createSign("RSA-SHA256");
  sign.update(signing);
  const signature = base64url(sign.sign(sa.private_key));
  return `${signing}.${signature}`;
}

/** Minimal https POST helper — returns parsed JSON body. */
function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = typeof body === "string" ? body : JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/** Minimal https PATCH helper — returns parsed JSON body. */
function patch(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   "PATCH",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/** Minimal https GET helper — returns parsed JSON body. */
function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   "GET",
      headers,
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on("error", reject);
    req.end();
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load credentials and cors config
  const sa         = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, "utf8"));
  const corsConfig = JSON.parse(fs.readFileSync(CORS_SRC, "utf8"));

  // 2. Get OAuth2 access token
  console.log("[1/3] Obtaining access token for:", sa.client_email);
  const tokenRes = await post(
    "https://oauth2.googleapis.com/token",
    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${makeJwt(sa)}`,
    { "Content-Type": "application/x-www-form-urlencoded" }
  );
  if (tokenRes.status !== 200 || !tokenRes.body.access_token) {
    console.error("[apply-storage-cors] Failed to get access token:", tokenRes.body);
    process.exit(1);
  }
  const token = tokenRes.body.access_token;
  console.log("[1/3] Access token obtained.");

  // 3. PATCH the bucket CORS config via GCS JSON API
  const bucketEncoded = encodeURIComponent(BUCKET);
  console.log(`[2/3] Applying CORS to bucket: ${BUCKET}`);
  const patchRes = await patch(
    `https://storage.googleapis.com/storage/v1/b/${bucketEncoded}?fields=cors`,
    { cors: corsConfig },
    { Authorization: `Bearer ${token}` }
  );
  if (patchRes.status !== 200) {
    console.error("[apply-storage-cors] PATCH failed:", patchRes.body);
    process.exit(1);
  }
  console.log("[2/3] CORS applied successfully.");

  // 4. Verify — GET bucket metadata and print the live CORS config
  console.log("[3/3] Verifying...");
  const verifyRes = await get(
    `https://storage.googleapis.com/storage/v1/b/${bucketEncoded}?fields=cors`,
    { Authorization: `Bearer ${token}` }
  );
  console.log("[3/3] Live CORS on bucket:");
  console.log(JSON.stringify(verifyRes.body.cors, null, 2));
  console.log("\nDone. The CORS error in the browser should now be resolved.");
}

main().catch((err) => {
  console.error("[apply-storage-cors] Unexpected error:", err.message);
  process.exit(1);
});
