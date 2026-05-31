import { apiClient } from './apiClient';
import type { SiteConfig } from '../types/config';

/**
 * Converts a File to base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Checks if image dimensions and file size are acceptable
 */
export async function checkBannerImage(file: File): Promise<void> {
  // Check file size (max 500KB for banner)
  const MAX_SIZE = 500 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(
      `Image is ${Math.round(file.size / 1024)} KB. Maximum allowed is 500 KB. Please compress or resize the image.`
    );
  }

  // Check dimensions
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;

      // Recommended: 1920x600 (3.2:1 ratio for banner)
      // But we'll be flexible - just ensure it's reasonably wide
      if (width < 800) {
        reject(new Error(`Image width is ${width}px. Minimum recommended width is 800px for a banner.`));
        return;
      }

      if (height < 200) {
        reject(new Error(`Image height is ${height}px. Minimum recommended height is 200px for a banner.`));
        return;
      }

      // Warn if aspect ratio is too tall (should be wide)
      const aspectRatio = width / height;
      if (aspectRatio < 2) {
        console.warn(`Banner aspect ratio is ${aspectRatio.toFixed(2)}:1. Recommended: 3:1 or wider for best display.`);
      }

      resolve();
    };
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Uploads a home banner image
 */
export async function uploadHomeBanner(file: File): Promise<string> {
  console.log('[uploadHomeBanner] Starting upload', {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });

  // Validate image first
  await checkBannerImage(file);

  // Convert to base64
  const base64 = await fileToBase64(file);
  
  console.log('[uploadHomeBanner] Base64 conversion complete', {
    base64Length: base64.length,
    base64Prefix: base64.substring(0, 100),
  });

  // Upload via API
  const response = await apiClient.post<{ bannerImage: string }>('config', { base64 });
  
  console.log('[uploadHomeBanner] Upload successful', {
    bannerUrl: response.bannerImage,
  });
  
  return response.bannerImage;
}

/**
 * Gets the current site configuration
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  return apiClient.get<SiteConfig>('config');
}

/**
 * Deletes the current home banner
 */
export async function deleteHomeBanner(): Promise<void> {
  await apiClient.delete<{ success: boolean }>('config/banner');
}
