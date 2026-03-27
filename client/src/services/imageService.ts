import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFirebaseApp } from './firebaseClient';
import { v4 as uuidv4 } from "uuid";

const FUNCTIONS_BASE =
  process.env.REACT_APP_FUNCTIONS_BASE_URL ||
  `https://asia-south1-shopping-app-63a1f.cloudfunctions.net`;

export function generateImageName(category: string, title?: string): string {
  const rand = uuidv4();
  return `shopping-app-${rand}.jpg`;
}

function compressToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 600;
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
      resolve(canvas.toDataURL('image/jpeg', 0.74));
    };
    img.src = blobUrl;
  });
}

export async function checkImageSize(file: File): Promise<string> {
  const MAX_BYTES = 65 * 1024;
  const base64 = await compressToDataUrl(file);
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const approxBytes = Math.ceil((base64Data.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    throw new Error(
      `"${file.name}" is ${Math.round(approxBytes / 1024)} KB after compression — ` +
      `max allowed is 65 KB. Please use a smaller or lower-resolution image.`
    );
  }
  return base64;
}

export async function uploadImage(
  file: File,
  category: string,
  title: string,
): Promise<string> {
  const filename = generateImageName(category, title);

  const storageMode =
    process.env.REACT_APP_IMAGE_STORAGE ||
    (process.env.REACT_APP_USE_EMULATOR === 'true' ? 'local' : 'firebase');

  const base64 = await checkImageSize(file);

  if (storageMode === 'local') {
    const resp = await fetch(`${FUNCTIONS_BASE}/images/upload`, {
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

  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase app not initialised — check firebaseClient.ts');
  const storage = getStorage(app);
  const storageRef = ref(storage, `products/${filename}`);
  await uploadString(storageRef, base64, 'data_url');
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

export async function uploadImages(
  files: File[],
  category: string,
  title: string,
): Promise<string[]> {
  return Promise.all(files.map((f) => uploadImage(f, category, title)));
}
