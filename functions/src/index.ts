/**
 * index.ts — Firebase Cloud Functions entry point.
 *
 * Exports a single `api` function backed by an Express app.
 * All routes live under their respective routers in src/routes/.
 *
 * URL pattern (production):
 *   https://asia-south1-<PROJECT>.cloudfunctions.net/api/<resource>
 *
 * URL pattern (local emulator):
 *   http://127.0.0.1:5001/<PROJECT>/asia-south1/api/<resource>
 */

// firebase.ts MUST be imported first — it sets emulator env vars and
// calls admin.initializeApp() before any other module uses the Admin SDK.
import "./firebase";

import { setGlobalOptions } from "firebase-functions";
import { onRequest }        from "firebase-functions/https";
import app                  from "./app";

setGlobalOptions({ maxInstances: 10, region: "asia-south1" });

/** Single Cloud Function that delegates all routing to the Express app. */
export const api = onRequest(app);
