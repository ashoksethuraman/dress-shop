export const IMAGE_BASE_URL: string = '/assets/';

export function resolveImageUrl(imageValue: string): string {
  if (!imageValue) return '';
  if (imageValue.startsWith('http') || imageValue.startsWith('/') || imageValue.startsWith('data:')) {
    return imageValue;
  }
  return `${IMAGE_BASE_URL}${imageValue}`;
}
