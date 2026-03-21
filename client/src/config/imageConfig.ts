/**
 * Base URL for product images.
 *
 * LOCAL DEV  →  '/assets/'
 * PRODUCTION →  Replace with your Firebase Storage base URL, e.g.:
 *   'https://firebasestorage.googleapis.com/v0/b/<YOUR_BUCKET>/o/products%2F?alt=media&token=...'
 *
 * Only the image filename (e.g. 'mens-1.jpeg') needs to be stored in Firestore.
 * The full URL is assembled at runtime by resolveImageUrl().
 */
export const IMAGE_BASE_URL: string = '/assets/';

/**
 * Resolves a stored image value to a fully-qualified URL.
 *
 * - If the value is already a full URL (http/https) or an absolute path (/...)
 *   it is returned as-is (backward compatibility with legacy data).
 * - Otherwise the filename is appended to IMAGE_BASE_URL.
 */
export function resolveImageUrl(imageValue: string): string {
  if (!imageValue) return '';
  // Full URL (http/https), absolute path (/assets/...), or data URL — pass through as-is
  if (imageValue.startsWith('http') || imageValue.startsWith('/') || imageValue.startsWith('data:')) {
    return imageValue;
  }
  return `${IMAGE_BASE_URL}${imageValue}`;
}
