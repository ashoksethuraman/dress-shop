import type {ValidationResult} from "../types";

/**
 * Validates the home banner upload request body.
 * Expects: { base64: string }
 */
export function validateHomeBannerUpload(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return {valid: false, error: "Request body is required."};
  }

  const {base64} = body as {base64?: unknown};

  if (!base64 || typeof base64 !== "string") {
    return {valid: false, error: "base64 image data is required.", field: "base64"};
  }

  // Basic base64 validation - check if it starts with "image/"
  // if (!base64.startsWith("image/")) {
  //   return {valid: false, error: "Invalid image format. Must be a data URL.", field: "base64"};
  // }

  // Check if it's a supported format
  const supportedFormats = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  const hasValidFormat = supportedFormats.some((fmt) => base64.startsWith(fmt));

  if (!hasValidFormat) {
    return {
      valid: false,
      error: "Unsupported image format. Only JPEG, PNG, and WebP are allowed.",
      field: "base64",
    };
  }

  // Rough size check (base64 is ~33% larger than binary)
  // 250KB binary ≈ 333KB base64, but let's be generous and allow up to 500KB for banner
  const MAX_BASE64_SIZE = 666 * 1024; // ~500KB binary
  if (base64.length > MAX_BASE64_SIZE) {
    return {
      valid: false,
      error: "Image too large. Maximum size is 500KB.",
      field: "base64",
    };
  }

  return {valid: true};
}
