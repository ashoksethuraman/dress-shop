import { authService } from './authService';
import { API_BASE_URL } from './apiClient';

function compressToDataUrl(file: File, maxPx = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxPx) {
        height = Math.round((height * maxPx) / width);
        width = maxPx;
      } else if (height > maxPx) {
        width = Math.round((width * maxPx) / height);
        height = maxPx;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = blobUrl;
  });
}

/** Client-side size guard: each product image must be ≤ 250 KB. */
export async function checkImageSize(file: File): Promise<void> {
  const MAX_BYTES = 250 * 1024;
  if (file.size > MAX_BYTES) {
    throw new Error(`"${file.name}" is ${Math.round(file.size / 1024)} KB — max allowed per product image is 250 KB.`);
  }
}

/** Compress and upload one image to Firebase Storage via the backend. Returns the public URL. */
async function uploadToBackend(
  file: File,
  folder: 'products' | 'size-charts',
): Promise<string> {
  const base64 = await compressToDataUrl(file);
  const csrf = authService.getCsrfToken();

  const resp = await fetch(`${API_BASE_URL}/images/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    body: JSON.stringify({ base64, folder }),
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      throw new Error('Your session has expired. Please log in again and retry upload.');
    }
    if (resp.status === 403) {
      throw new Error('Admin access is required to upload images.');
    }
    const err = await resp.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Image upload failed (${resp.status}).`);
  }

  const data = await resp.json() as { url: string };
  return data.url;
}

export async function uploadImage(file: File, _category: string, _title: string): Promise<string> {
  return uploadToBackend(file, 'products');
}

export async function uploadImages(files: File[], category: string, title: string): Promise<string[]> {
  return Promise.all(files.map((f) => uploadImage(f, category, title)));
}

/** Upload a size-chart image and return its public URL. Max 250 KB raw enforced client-side. */
export async function uploadSizeChart(file: File): Promise<string> {
  const MAX_BYTES = 250 * 1024;
  if (file.size > MAX_BYTES) {
    throw new Error(`Size chart "${file.name}" is ${Math.round(file.size / 1024)} KB — max allowed is 250 KB.`);
  }
  return uploadToBackend(file, 'size-charts');
}
