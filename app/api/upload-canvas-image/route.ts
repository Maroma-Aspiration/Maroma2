import { NextResponse } from "next/server";
import {
  fileToDataUrl,
  isBlobStoreUnavailableError,
  isCanvasBlobConfigured,
  uploadLegacyBlobFile,
} from "../../../lib/canvas-legacy-blob";
import { isCanvasFirebaseConfigured, uploadCanvasFile } from "../../../lib/canvas-firebase-storage";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (isCanvasFirebaseConfigured()) {
      try {
        const url = await uploadCanvasFile(file);
        return NextResponse.json({ url, storage: "firebase" });
      } catch (err) {
        if (!isBlobStoreUnavailableError(err)) throw err;
      }
    }

    if (isCanvasBlobConfigured()) {
      try {
        const url = await uploadLegacyBlobFile(file);
        return NextResponse.json({ url, storage: "legacy-blob" });
      } catch (err) {
        if (!isBlobStoreUnavailableError(err)) throw err;
      }
    }

    const url = await fileToDataUrl(file);
    return NextResponse.json({
      url,
      storage: "inline",
      warning: isCanvasFirebaseConfigured()
        ? "Firebase upload failed; image stored inline in newsletter state."
        : isCanvasBlobConfigured()
          ? "Firebase and legacy blob upload both failed; image stored inline in newsletter state."
          : "Firebase Storage is not configured; image stored inline. Set FIREBASE_* env vars for durable storage.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
