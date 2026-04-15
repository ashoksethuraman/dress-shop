export const IMAGE_BASE_URL: string = '/assets/';
export const IMAGE_STORAGE_URL : string = 'https://firebasestorage.googleapis.com/v0/b/halleycomet-7cd48.firebasestorage.app/o/';

export function resolveImageUrl(imageValue: string): string {
  console.log('image values :: resolve  image URL  : ', imageValue );
  if (!imageValue) return '';
  if (imageValue.startsWith('products')  || imageValue.startsWith('size-charts') || imageValue.startsWith('data:')) {
    console.log('reset:::::',`${IMAGE_STORAGE_URL}${imageValue}`)
    return `${IMAGE_STORAGE_URL}${imageValue}`;
  }
  return `${IMAGE_BASE_URL}${imageValue}`;
}
