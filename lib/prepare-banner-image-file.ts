const MAX_UPLOAD_BYTES = Math.floor(3.2 * 1024 * 1024);
const MAX_EDGE_PX = 2400;

export async function prepareBannerImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a JPEG, PNG, or WebP image.");
  }
  if (file.size <= MAX_UPLOAD_BYTES) {
    return file;
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error("That image is too large to upload (max about 4MB). Try a smaller file.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare that image for upload.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) resolve(next);
        else reject(new Error("Could not compress that image."));
      },
      "image/jpeg",
      0.82
    );
  });

  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("That image is still too large after compression. Try a smaller crop.");
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "banner";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}
