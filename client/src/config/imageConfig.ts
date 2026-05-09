export const IMAGE_BASE_URL: string = '/assets/';
export const IMAGE_STORAGE_URL : string = 'https://firebasestorage.googleapis.com/v0/b/halleycomet-7cd48.firebasestorage.app/o/';

export function resolveImageUrl(imageValue: string): string {
  // Defensive: return empty for falsy
  if (!imageValue) return '';

  // Try to decode once in case the value is URL-encoded (or double-encoded)
  let val = String(imageValue);
  try { val = decodeURIComponent(val); } catch (e) { /* ignore decode errors */ }

  // data URLs should be returned as-is
  if (val.startsWith('data:')) return val;

  // If it's already a full URL, return directly
  if (val.startsWith('http')) return val;

  // Split object path and query string (e.g. 'products/abc.jpg?alt=media&token=...')
  const qIdx = val.indexOf('?');
  const path = qIdx >= 0 ? val.slice(0, qIdx) : val;
  const query = qIdx >= 0 ? val.slice(qIdx + 1) : '';

  // For storage object names (folder/object), Firebase expects the object name to be URL-encoded
  if (path.startsWith('products') || path.startsWith('size-charts')) {
    const encodedPath = encodeURIComponent(path);
    return `${IMAGE_STORAGE_URL}${encodedPath}${query ? `?${query}` : ''}`;
  }

  // Fallback to local asset path
  return `${IMAGE_BASE_URL}${val}`;
}
