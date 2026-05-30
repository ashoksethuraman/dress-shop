import { resolveImageUrl } from '../config/imageConfig';

export type ImageMeta = {
  src?: string;
  isPlaceholder: boolean;
};

/**
 * Return the resolved URL for a product's image (first image by default).
 * Falls back to placeholder meta when no usable image is found.
 */
export function getProductImage(product: any, opts?: { index?: number }): ImageMeta {
  const index = opts?.index ?? 0;

  if (!product) return { isPlaceholder: true };

  let candidate: string | undefined;
  if (Array.isArray(product.images) && product.images.length > 0) {
    candidate = product.images[index] ?? product.images[0];
  }
  if (!candidate && typeof product.image === 'string') {
    candidate = product.image;
  }

  if (!candidate) return { isPlaceholder: true };

  try {
    const resolved = resolveImageUrl(candidate);
    if (!resolved) return { isPlaceholder: true };
    return { src: resolved, isPlaceholder: false };
  } catch (err) {
    return { isPlaceholder: true };
  }
}

export function getProductImages(product: any): string[] {
  if (!product) return [];
  const raw = Array.isArray(product.images) && product.images.length
    ? product.images
    : product.image ? [product.image] : [];
  return raw.map((r: string) => {
    try { return resolveImageUrl(r); } catch { return ''; }
  }).filter(Boolean);
}
