/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {Router, type Request, type Response} from "express";
import * as crypto from "crypto";
import * as logger from "firebase-functions/logger";
import {authenticate, requireAdmin} from "../middleware";
import {admin} from "../config/firebase";

export const imagesRouter = Router();

const ALLOWED_FOLDERS = ["products", "size-charts"];
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

imagesRouter.post("/upload", authenticate, requireAdmin, (req: Request, res: Response) => {
  const {base64, folder} = req.body as {base64?: string; folder?: string};
  if (!base64) {
    res.status(400).json({error: "base64 is required."});
    return;
  }

  // Validate MIME type from the data-URI prefix before decoding anything
  const mimeMatch = base64.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch?.[1] ?? "";
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    res.status(400).json({error: `Unsupported image type "${mimeType}". Allowed: JPEG, PNG, WebP.`});
    return;
  }

  const safeFolder = ALLOWED_FOLDERS.includes(folder ?? "") ? folder! : "products";
  const imageData = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(imageData, "base64");
  const ext = getExtension(mimeType);
  const uniqueName = `halleycomet_${crypto.randomUUID()}.${ext}`;
  const objectPath = `${safeFolder}/${uniqueName}`;
  const downloadToken = crypto.randomUUID();

  const bucket = admin.storage().bucket();
  const object = bucket.file(objectPath);

  object.save(buffer, {
    resumable: false,
    contentType: mimeType,
    metadata: {
      cacheControl: "public,max-age=31536000,immutable",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  }).then(() => {
    const encodedPath = encodeURIComponent(objectPath);
    const publicUrl = `${encodedPath}?alt=media&token=${downloadToken}`;
    logger.info(`[POST /images/upload] Uploaded to bucket ${bucket.name}: ${objectPath}`);
    res.json({url: publicUrl});
  }).catch((err) => {
    logger.error("[POST /images/upload] storage upload error", {error: err});
    res.status(500).json({error: "Failed to upload image to Firebase Storage."});
  });
});

