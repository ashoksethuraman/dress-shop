/**
 * routes/images.ts — Local‑development image upload router.
 *
 * POST  /images/upload  — emulator only — accepts a base64 image + filename,
 *                         writes to client/public/assets/ for the React dev server.
 *
 * SECURITY: Blocked in production — only available when FUNCTIONS_EMULATOR=true
 * (set automatically by the Firebase Emulator Suite).
 *
 * Path resolution (compiled output lives in functions/lib/routes/):
 *   __dirname → functions/lib/routes/
 *   target    → ../../../client/public/assets/
 *             → dress-shop/client/public/assets/  ✓
 */

import { Router, type Request, type Response } from "express";
import * as fs   from "fs";
import * as path from "path";
import * as logger from "firebase-functions/logger";

export const imagesRouter = Router();

const SAFE_FILENAME_RE = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

// ── POST /images/upload  (emulator only) ─────────────────────────────────
imagesRouter.post("/upload", async (req: Request, res: Response) => {
  if (process.env.FUNCTIONS_EMULATOR !== "true") {
    res.status(403).json({ error: "This endpoint is only available in the local emulator." });
    return;
  }

  const { base64, filename } = req.body as { base64?: string; filename?: string };

  if (!base64 || !filename) {
    res.status(400).json({ error: "base64 and filename are required." });
    return;
  }

  // Sanitise filename — prevent path traversal attacks
  const safeName = path.basename(filename);
  if (!SAFE_FILENAME_RE.test(safeName)) {
    res.status(400).json({
      error: "Invalid filename — must be alphanumeric / dashes / underscores with a .jpg, .jpeg, .png, or .webp extension.",
    });
    return;
  }

  const assetsDir = path.resolve(__dirname, "..", "..", "..", "client", "public", "assets");
  const filePath  = path.join(assetsDir, safeName);

  try {
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    const data = base64.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    logger.info(`[POST /images/upload] Saved: ${safeName}`);
    res.json({ path: `/assets/${safeName}` });
  } catch (err) {
    logger.error("[POST /images/upload] write error", { filename, error: err });
    res.status(500).json({ error: "Failed to save image to public/assets." });
  }
});
