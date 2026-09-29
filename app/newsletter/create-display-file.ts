import { canvasDisplayMaxWidth } from "../../lib/canvas-display-image";

function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type || "image/webp" });
}

/** Browser-only retina display copy. Original upload stays untouched. */
export async function createBrowserDisplayFile(
  file: File,
  id?: string,
): Promise<File | null> {
  if (!file.type.startsWith("image/") || file.type.includes("svg")) return null;
  const maxWidth = canvasDisplayMaxWidth(id);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, maxWidth / Math.max(1, bitmap.width));
    if (scale === 1 && file.size < 180_000) return null;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/webp", 0.9);
    });
    if (!blob || blob.size <= 0) {
      const jpeg = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((next) => resolve(next), "image/jpeg", 0.92);
      });
      if (!jpeg || jpeg.size <= 0) return null;
      return blobToFile(jpeg, "display.jpg");
    }
    return blobToFile(blob, "display.webp");
  } finally {
    bitmap.close();
  }
}
