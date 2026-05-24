import type {ValidationResult} from "../types";
import * as logger from "firebase-functions/logger";

/**
 * Validates the home banner upload request body.
 * Expects: { base64: string }
 */
export function validateHomeBannerUpload(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    logger.warn("[validateHomeBannerUpload] Request body is missing or invalid");
    return {valid: false, error: "Request body is required."};
  }

  const {base64} = body as {base64?: unknown};

  if (!base64 || typeof base64 !== "string") {
    logger.warn("[validateHomeBannerUpload] base64 field is missing or not a string");
    return {valid: false, error: "base64 image data is required.", field: "base64"};
  }

  // Log the incoming base64 prefix for debugging
  const base64Prefix = base64.substring(0, 100);
  logger.info("[validateHomeBannerUpload] Received base64 data", {
    length: base64.length,
    prefix: base64Prefix,
  });

  // Check if it's a valid data URL with supported format
  // All formats should start with "image/"
  const supportedFormats = [
    "image/jpeg",
    "data:image/jpeg",
    "data:image/jpg",
    "image/png",
    "image/webp",
    "data:image/webp"
  ];

  logger.info("[validateHomeBannerUpload] Checking against supported formats", {
    supportedFormats,
  });

  const hasValidFormat = supportedFormats.some((fmt) => {
    const matches = base64.toLowerCase().startsWith(fmt.toLowerCase());
    logger.info(`[validateHomeBannerUpload] Checking format "${fmt}": ${matches}`);
    return matches;
  });

  if (!hasValidFormat) {
    // Extract what format was actually provided
    const dataUrlMatch = base64.match(/^([^;,]+)/);
    const detectedFormat = dataUrlMatch ? dataUrlMatch[1] : "unknown";
    
    logger.error("[validateHomeBannerUpload] Invalid format detected", {
      detectedFormat,
      base64Prefix,
      supportedFormats,
    });

    return {
      valid: false,
      error: `Unsupported image format detected: "${detectedFormat}". Only JPEG, PNG, and WebP are allowed.`,
      field: "base64",
    };
  }

  logger.info("[validateHomeBannerUpload] Format validation passed");

  // Rough size check (base64 is ~33% larger than binary)
  // 250KB binary ≈ 333KB base64, but let's be generous and allow up to 500KB for banner
  const MAX_BASE64_SIZE = 666 * 1024; // ~500KB binary
  if (base64.length > MAX_BASE64_SIZE) {
    logger.warn("[validateHomeBannerUpload] Image too large", {
      length: base64.length,
      maxSize: MAX_BASE64_SIZE,
    });
    return {
      valid: false,
      error: "Image too large. Maximum size is 500KB.",
      field: "base64",
    };
  }

  logger.info("[validateHomeBannerUpload] Validation successful");
  return {valid: true};
}
