/**
 * Client-side image compression before upload.
 * Keeps GIF/SVG untouched and skips already-small files (< 120 KB).
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<File> {
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml' ||
    file.size < 120 * 1024
  ) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca gambar'));
      el.src = objectUrl;
    });

    let { naturalWidth: w, naturalHeight: h } = img;
    if (w <= 0 || h <= 0) return file;

    if (w > maxDimension || h > maxDimension) {
      const ratio = Math.min(maxDimension / w, maxDimension / h);
      w = Math.max(1, Math.round(w * ratio));
      h = Math.max(1, Math.round(h * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, w, h);

    const outMime = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outMime, quality);
    });

    if (!blob || blob.size >= file.size) return file;

    const ext = outMime === 'image/webp' ? 'webp' : 'jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.${ext}`, { type: outMime });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
