/**
 * imageService.ts — image upload abstraction
 *
 * Storage back-end is controlled by REACT_APP_IMAGE_STORAGE:
 *
 *   local    (default when REACT_APP_USE_EMULATOR=true)
 *            POSTs compressed JPEG to the local Cloud Functions emulator.
 *            The emulator writes the file to client/public/assets/.
 *            Stored value in Firestore: filename only, e.g. "men_polo_a3f8b120.jpg"
 *            Rendered via IMAGE_BASE_URL → "/assets/{filename}"
 *
 *   firebase (set REACT_APP_IMAGE_STORAGE=firebase for production)
 *            Uploads directly to Firebase Storage under products/{filename}.
 *            Stored value in Firestore: full HTTPS download URL.
 *            resolveImageUrl() passes full URLs through as-is.
 *
 * To switch from local → Firebase Storage later:
 *   1. Set REACT_APP_IMAGE_STORAGE=firebase in .env.local
 *   2. IMAGE_BASE_URL in imageConfig.ts doesn't need to change for firebase mode.
 */

import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFirebaseApp } from './firebaseClient';
import { v4 as uuidv4 } from "uuid";

const FUNCTIONS_BASE =
  process.env.REACT_APP_FUNCTIONS_BASE_URL ||
  `https://asia-south1-shopping-app-63a1f.cloudfunctions.net`;

/**
 * Generates a safe, unique image filename.
 * Pattern: {category}_{title-slug}_{8-char-random}.jpg
 * Example: men_polo-shirt_a3f8b120.jpg
 */
export function generateImageName(category: string, title?: string): string {
  // const slug = title
  //   .toLowerCase()
  //   .replace(/[^a-z0-9]+/g, '-')
  //   .replace(/^-|-$/g, '')
  //   .slice(0, 30);
  const rand = uuidv4();
  return `shopping-app-${rand}.jpg`;
}

/** Compresses a File to a JPEG data-URL (max 400 px on longest side, 78 % quality). */
function compressToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 400;
      let { width, height } = img;
      if (width > height && width > MAX) {
        height = Math.round((height * MAX) / width);
        width = MAX;
      } else if (height > MAX) {
        width = Math.round((width * MAX) / height);
        height = MAX;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(blobUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.src = blobUrl;
  });
}

/**
 * Checks a File's compressed size against the 60 KB limit without uploading it.
 * Rejects with a user-friendly message if the file is too large after compression.
 * Resolves with the compressed data-URL if the file is within limits (reused by uploadImage).
 */
export async function checkImageSize(file: File): Promise<string> {
  const MAX_BYTES = 60 * 1024;
  const base64 = await compressToDataUrl(file);
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const approxBytes = Math.ceil((base64Data.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    throw new Error(
      `"${file.name}" is ${Math.round(approxBytes / 1024)} KB after compression — ` +
      `max allowed is 60 KB. Please use a smaller or lower-resolution image.`
    );
  }
  return base64;
}

/**
 * Uploads a single image file and returns the value to store in Firestore.
 *
 * @param file     - Raw File object from an <input type="file">
 * @param category - Product category used in the filename ('men' | 'women')
 * @param title    - Product title used in the filename
 * @returns        - Filename (local mode) or Firebase Storage download URL (firebase mode)
 */
export async function uploadImage(
  file: File,
  category: string,
  title: string,
): Promise<string> {
  const filename = generateImageName(category, title);

  // Resolve storage mode: explicit env var, or auto-detect from emulator flag
  const storageMode =
    process.env.REACT_APP_IMAGE_STORAGE ||
    (process.env.REACT_APP_USE_EMULATOR === 'true' ? 'local' : 'firebase');

  const base64 = await checkImageSize(file); // compresses + validates size

  // ── Local mode: emulator writes file to client/public/assets/ ──────────────
  if (storageMode === 'local') {
    const resp = await fetch(`${FUNCTIONS_BASE}/apiUploadLocalImage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, filename }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Local image upload failed (${resp.status}): ${body}`);
    }
    const { path } = await resp.json();
    return path as string; // '/assets/{filename}'
  }

  // ── Firebase Storage mode ──────────────────────────────────────────────────
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase app not initialised — check firebaseClient.ts');
  const storage = getStorage(app);
  const storageRef = ref(storage, `products/${filename}`);
  await uploadString(storageRef, base64, 'data_url');
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

/**
 * Uploads multiple image files (used by AddProduct to upload the full images[] array).
 * Returns an array of paths/URLs in the same order as the input files.
 */
export async function uploadImages(
  files: File[],
  category: string,
  title: string,
): Promise<string[]> {
  return Promise.all(files.map((f) => uploadImage(f, category, title)));
}
