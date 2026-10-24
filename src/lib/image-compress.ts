const MAX_EDGE = 2000;
const QUALITY = 0.85;

/**
 * Scales an image down to at most MAX_EDGE px on its longest side and
 * re-encodes it as WebP (or JPEG where WebP encoding isn't supported).
 * Falls back to the original file if the browser can't decode it.
 */
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;
  return (await toBlob(canvas, "image/jpeg")) ?? file;
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export function extensionFor(type: string) {
  return { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif" }[type] ?? "jpg";
}
