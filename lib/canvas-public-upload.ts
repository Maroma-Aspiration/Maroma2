import {
  isCanvasFirebaseConfigured,
  makeCanvasObjectPath,
  uploadCanvasBuffer,
} from "./canvas-firebase-storage";
import {
  isCanvasBlobConfigured,
  uploadLegacyBlobBuffer,
} from "./canvas-legacy-blob";

function extForMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("gltf-binary") || mime.includes("model/gltf")) return "glb";
  return "jpg";
}

export type CanvasPublicUploadResult = {
  url: string;
  storage: "firebase" | "legacy-blob";
};

/**
 * Upload bytes to a public HTTPS host for email clients.
 * Prefers Firebase Storage; falls back to Vercel Blob.
 */
export async function uploadCanvasPublicBuffer(
  prefix: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<CanvasPublicUploadResult> {
  const mime = contentType || "image/jpeg";
  const ext = extForMime(mime);
  const errors: string[] = [];

  if (isCanvasFirebaseConfigured()) {
    try {
      const path = makeCanvasObjectPath(prefix, ext);
      const url = await uploadCanvasBuffer(path, body, mime);
      return { url, storage: "firebase" };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (isCanvasBlobConfigured()) {
    try {
      const url = await uploadLegacyBlobBuffer(body, mime, prefix);
      return { url, storage: "legacy-blob" };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error(
    errors.length
      ? `Public image upload failed: ${errors.join(" | ")}`
      : "No public image storage configured. Set FIREBASE_* or BLOB_READ_WRITE_TOKEN."
  );
}

/** Upload a reconstructed GLB (or other binary) with an explicit file extension. */
export async function uploadPublicBinary(
  prefix: string,
  body: Buffer | Uint8Array,
  contentType: string,
  ext: string
): Promise<CanvasPublicUploadResult> {
  const mime = contentType || "application/octet-stream";
  const safeExt = ext.replace(/^\./, "").trim() || extForMime(mime);
  const errors: string[] = [];

  if (isCanvasFirebaseConfigured()) {
    try {
      const path = makeCanvasObjectPath(prefix, safeExt);
      const url = await uploadCanvasBuffer(path, body, mime);
      return { url, storage: "firebase" };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (isCanvasBlobConfigured()) {
    try {
      const url = await uploadLegacyBlobBuffer(body, mime, prefix);
      return { url, storage: "legacy-blob" };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error(
    errors.length
      ? `Public file upload failed: ${errors.join(" | ")}`
      : "No public file storage configured. Set FIREBASE_* or BLOB_READ_WRITE_TOKEN."
  );
}

export function isPublicHttpsImageUrl(src: string | undefined | null): boolean {
  const trimmed = (src ?? "").trim();
  return /^https:\/\//i.test(trimmed);
}
