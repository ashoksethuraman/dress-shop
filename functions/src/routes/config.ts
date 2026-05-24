import {Router, type Request, type Response} from "express";
import * as logger from "firebase-functions/logger";
import {v4 as uuidv4} from "uuid";
import {FieldValue} from "firebase-admin/firestore";
import {db, admin} from "../config/firebase";
import {authenticate, requireAdmin, validate} from "../middleware";
import {validateHomeBannerUpload} from "../validators/configValidators";

// eslint-disable-next-line new-cap
export const configRouter = Router();

/**
 * Helper to generate random filename
 */
function generateRandomFilename(ext: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `banner-${timestamp}-${randomStr}.${ext}`;
}

/**
 * GET /config
 * Public endpoint - returns site configuration with bannerImage and contactInfo
 */
configRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const doc = await db.collection("config").doc("settings").get();

    if (!doc.exists) {
      // Return default empty config if not set
      return res.json({
        bannerImage: null,
        contactInfo: null,
      });
    }

    const data = doc.data();
    return res.json({
      bannerImage: data?.bannerImage || null,
      contactInfo: data?.contactInfo || null,
    });
  } catch (err) {
    logger.error("[GET /config] error", err);
    return res.status(500).json({error: "Failed to fetch site configuration."});
  }
});

/**
 * POST /config
 * Admin only - uploads a new home banner image
 */
configRouter.post(
  "/",
  authenticate,
  requireAdmin,
  validate(validateHomeBannerUpload),
  async (req: Request, res: Response) => {
    try {
      const requestId = uuidv4().substring(0, 8);
      const {base64} = req.body as {base64: string};

      logger.info(`[POST /config:${requestId}] Banner upload request received`, {
        userId: (req as any).user?.uid,
        base64Length: base64?.length,
        base64Prefix: base64?.substring(0, 100),
      });

      // Validate base64 format
      const dataUrlMatch = base64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);

      logger.info(`[POST /config:${requestId}] Regex match result`, {
        matched: !!dataUrlMatch,
        format: dataUrlMatch?.[1],
        hasData: !!dataUrlMatch?.[2],
      });

      if (!dataUrlMatch || !dataUrlMatch[2]) {
        const detectedPrefix = base64.substring(0, 50);
        logger.error(`[POST /config:${requestId}] Invalid format after validation`, {
          detectedPrefix,
        });
        return res.status(400).json({
          error: `Unsupported image format. Only JPEG, PNG, and WebP are allowed. Detected: ${detectedPrefix}`,
        });
      }

      const base64Data = dataUrlMatch[2];
      const mimeType = dataUrlMatch[1];

      // Convert base64 to buffer
      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Data, "base64");
      } catch (err) {
        return res.status(400).json({error: "Invalid base64 data."});
      }

      // Validate buffer size (max 500KB for banner images)
      const MAX_BUFFER_SIZE = 500 * 1024;
      if (buffer.length > MAX_BUFFER_SIZE) {
        return res.status(400).json({
          error: `Image too large (${Math.round(buffer.length / 1024)} KB). Maximum allowed is 500 KB.`,
        });
      }

      const ext = mimeType === "jpeg" || mimeType === "jpg" ? "jpg" : mimeType;
      const fileName = generateRandomFilename(ext);
      const objectPath = `config/banners/${fileName}`;

      // Upload to Firebase Storage (uses default bucket)
      const bucket = admin.storage().bucket();
      const file = bucket.file(objectPath);
      const downloadToken = uuidv4();

      logger.info(`[POST /config:${requestId}] Storage configuration`, {
        bucketName: bucket.name,
        objectPath: objectPath,
        bufferSize: buffer.length,
        contentType: `image/${ext}`,
      });

      logger.info(`[POST /config:${requestId}] Uploading to bucket: ${bucket.name}, path: ${objectPath}`);

      try {
        await file.save(buffer, {
          resumable: false,
          contentType: `image/${ext}`,
          metadata: {
            cacheControl: "public,max-age=31536000,immutable",
            firebaseStorageDownloadTokens: downloadToken,
          },
        });

        // Verify file was actually uploaded
        const [exists] = await file.exists();
        if (!exists) {
          logger.error(`[POST /config:${requestId}] File upload failed - file does not exist after save`);
          throw new Error("File upload failed - file does not exist in storage");
        }

        logger.info(`[POST /config:${requestId}] File upload verified - exists in storage`);
      } catch (uploadErr) {
        logger.error(`[POST /config:${requestId}] Storage upload error`, {
          error: uploadErr,
          bucket: bucket.name,
          path: objectPath,
        });
        throw new Error(`Storage upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }

      // Generate public URL with correct Firebase Storage format
      const encodedPath = encodeURIComponent(objectPath);
      // Use bucket name directly without modification
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

      logger.info(`[POST /config] Generated banner URL: ${publicUrl}`);

      // Get current banner to delete old one
      const configDoc = await db.collection("config").doc("settings").get();
      const oldBannerUrl = configDoc.exists ? configDoc.data()?.bannerImage : null;

      // Extract old file path from URL if exists
      let oldFilePath: string | null = null;
      if (oldBannerUrl && typeof oldBannerUrl === "string") {
        const urlMatch = oldBannerUrl.match(/\/o\/([^?]+)\?/);
        if (urlMatch && urlMatch[1]) {
          oldFilePath = decodeURIComponent(urlMatch[1]);
        }
      }

      // Update Firestore with new banner URL
      await db.collection("config").doc("settings").set(
        {
          bannerImage: publicUrl,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      // Delete old banner from storage if exists
      if (oldFilePath) {
        try {
          await bucket.file(oldFilePath).delete();
          logger.info(`[POST /config] Deleted old banner: ${oldFilePath}`);
        } catch (deleteErr) {
          logger.warn(`[POST /config] Could not delete old banner: ${oldFilePath}`, deleteErr);
        }
      }

      logger.info(`[POST /config] Uploaded banner: ${objectPath}`);
      return res.json({bannerImage: publicUrl});
    } catch (err) {
      logger.error("[POST /config] error", err);
      return res.status(500).json({error: "Failed to upload banner image."});
    }
  }
);

/**
 * DELETE /config/banner
 * Admin only - deletes the current home banner
 */
configRouter.delete(
  "/banner",
  authenticate,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const configDoc = await db.collection("config").doc("settings").get();

      if (!configDoc.exists) {
        return res.status(404).json({error: "No banner found."});
      }

      const bannerUrl = configDoc.data()?.bannerImage;

      if (!bannerUrl || typeof bannerUrl !== "string") {
        return res.status(404).json({error: "No banner found."});
      }

      // Extract file path from URL
      const urlMatch = bannerUrl.match(/\/o\/([^?]+)\?/);
      if (!urlMatch || !urlMatch[1]) {
        return res.status(400).json({error: "Invalid banner URL format."});
      }

      const filePath = decodeURIComponent(urlMatch[1]);

      // Delete from storage (uses default bucket)
      const bucket = admin.storage().bucket();
      await bucket.file(filePath).delete();

      // Remove from Firestore
      await db.collection("config").doc("settings").update({
        bannerImage: FieldValue.delete(),
      });

      logger.info(`[DELETE /config/banner] Deleted banner: ${filePath}`);
      return res.json({success: true});
    } catch (err) {
      logger.error("[DELETE /config/banner] error", err);
      return res.status(500).json({error: "Failed to delete banner."});
    }
  }
);

/**
 * GET /config/contact
 * Public endpoint - returns contact information
 */
configRouter.get("/contact", async (_req: Request, res: Response) => {
  try {
    const doc = await db.collection("config").doc("settings").get();

    if (!doc.exists || !doc.data()?.contactInfo) {
      // Return default contact info
      return res.json({
        tradeName: "Halley Comet Garments",
        brandName: "Halley Comet · Cozy Luna Wears",
        address: "27 Sample Colony, 1st Street, Tirupur – 641602, Tamil Nadu, India.",
        phone: "+91 XXXXX XXXXX",
        email: "support@halleycomet.com",
        operatingHours: "Monday – Saturday, 10:00 AM to 6:00 PM (IST)",
        mapUrl: "",
        socialMedia: {
          facebook: "",
          instagram: "",
          twitter: "",
          whatsapp: "+91 XXXXX XXXXX",
        },
      });
    }

    return res.json(doc.data()?.contactInfo);
  } catch (err) {
    logger.error("[GET /config/contact] error", err);
    return res.status(500).json({error: "Failed to fetch contact information."});
  }
});

/**
 * PUT /config/contact
 * Admin only - updates contact information
 */
configRouter.put(
  "/contact",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        tradeName,
        brandName,
        address,
        phone,
        email,
        operatingHours,
        mapUrl,
        socialMedia,
      } = req.body;

      // Basic validation
      if (!tradeName || !brandName || !address || !phone || !email) {
        return res.status(400).json({error: "Required fields: tradeName, brandName, address, phone, email"});
      }

      const contactInfo = {
        tradeName,
        brandName,
        address,
        phone,
        email,
        operatingHours: operatingHours || "",
        mapUrl: mapUrl || "",
        socialMedia: socialMedia || {
          facebook: "",
          instagram: "",
          twitter: "",
          whatsapp: "",
        },
      };

      // Update Firestore
      await db.collection("config").doc("settings").set(
        {
          contactInfo,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      logger.info("[PUT /config/contact] Updated contact information");
      return res.json(contactInfo);
    } catch (err) {
      logger.error("[PUT /config/contact] error", err);
      return res.status(500).json({error: "Failed to update contact information."});
    }
  }
);
