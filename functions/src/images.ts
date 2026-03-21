/**
 * images.ts — LOCAL DEVELOPMENT ONLY
 *
 * apiUploadLocalImage: accepts a base64 JPEG + filename, writes the file to
 * client/public/assets/ so it's immediately served by the React dev server.
 *
 * SECURITY: Blocked in production — only runs when FUNCTIONS_EMULATOR=true
 * (automatically set by the Firebase Emulator Suite).
 *
 * Path resolution (emulator):
 *   __dirname = functions/lib/
 *   target    = ../../client/public/assets/
 *             = dress-shop/client/public/assets/  ✓
 */

import * as fs from "fs";
import * as path from "path";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { setCors } from "./helpers";

const SAFE_FILENAME_RE = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

export const apiUploadLocalImage = onRequest(async (req, res) => {
  if (setCors(req, res)) return;
  logger.info("[apiUploadLocalImage] →", { method: req.method, filename: req.body?.filename });
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  // Block in production — only the emulator sets this env var to "true"
  if (process.env.FUNCTIONS_EMULATOR !== "true") {
    res.status(403).json({ error: "This endpoint is only available in the local emulator" });
    return;
  }

  const { base64, filename } = req.body as { base64?: string; filename?: string };

  if (!base64 || !filename) {
    res.status(400).json({ error: "base64 and filename are required" });
    return;
  }

  // Validate filename — prevent path traversal attacks
  const safeName = path.basename(filename);
  if (!SAFE_FILENAME_RE.test(safeName)) {
    res.status(400).json({ error: "Invalid filename — must be alphanumeric/dashes/underscores with a jpg/jpeg/png/webp extension" });
    return;
  }

  // Resolve destination: functions/lib/ → ../../client/public/assets/
  const assetsDir = path.resolve(__dirname, "..", "..", "client", "public", "assets");
  const filePath  = path.join(assetsDir, safeName);

  try {
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const data = base64.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    res.json({ path: `/assets/${safeName}` });
  } catch (err) {
    logger.error("[apiUploadLocalImage] write error", { filename: req.body?.filename, error: err });
    res.status(500).json({ error: "Failed to save image to public/assets" });
  }
});
