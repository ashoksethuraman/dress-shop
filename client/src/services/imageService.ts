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
  _category: string,
  _title: string,
): Promise<string> {
  return checkImageSize(file);
}

export async function uploadImages(
  files: File[],
  category: string,
  title: string,
): Promise<string[]> {
  return Promise.all(files.map((f) => uploadImage(f, category, title)));
}
