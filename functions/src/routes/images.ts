import {Router, type Request, type Response} from "express";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as logger from "firebase-functions/logger";
import {authenticate, requireAdmin} from "../middleware";

export const imagesRouter = Router();

const ALLOWED_FOLDERS = ["products", "size-charts"] as const;
type UploadFolder = typeof ALLOWED_FOLDERS[number];

imagesRouter.post("/upload", authenticate, requireAdmin, async (req: Request, res: Response) => {
  const {base64, folder} = req.body as {
    base64?: string;
    filename?: string; // accepted but ignored — name is generated server-side
    folder?: string;
  };

  if (!base64) {
    res.status(400).json({error: "base64 is required."});
    return;
  }

  const safeFolder: UploadFolder = ALLOWED_FOLDERS.includes(folder as UploadFolder)
    ? (folder as UploadFolder)
    : "products";

  const imageData = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(imageData, "base64");

  // Always name: halleycomet_<uuid>.jpg
  const uniqueName = `halleycomet_${crypto.randomUUID()}.jpg`;

  // Always save locally to client/public/assets/
  const assetsDir = path.resolve(__dirname, "..", "..", "..", "client", "public", "assets");
  const filePath = path.join(assetsDir, uniqueName);
  try {
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, {recursive: true});
    fs.writeFileSync(filePath, buffer);
    logger.info(`[POST /images/upload] Saved: ${uniqueName} (folder=${safeFolder})`);
    res.json({url: `/assets/${uniqueName}`});
  } catch (err) {
    logger.error("[POST /images/upload] write error", {error: err});
    res.status(500).json({error: "Failed to save image."});
  }
});
