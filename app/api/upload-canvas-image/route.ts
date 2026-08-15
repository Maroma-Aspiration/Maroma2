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

    const errors: string[] = [];

    if (isCanvasFirebaseConfigured()) {
      try {
        const url = await uploadCanvasFile(file);
        return NextResponse.json({ url, storage: "firebase" });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        // Always try Blob next — email clients cannot use data: URLs.
      }
    }

    if (isCanvasBlobConfigured()) {
      try {
        const url = await uploadLegacyBlobFile(file);
        return NextResponse.json({
          url,
          storage: "legacy-blob",
          warning: errors.length
            ? `Firebase upload failed (${errors[0]}); used Vercel Blob instead.`
            : undefined,
        });
      } catch (err) {
        if (!isBlobStoreUnavailableError(err) && errors.length === 0) {
          // keep going to inline fallback
        }
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    const url = await fileToDataUrl(file);
    return NextResponse.json({
      url,
      storage: "inline",
      warning:
        "Image stored inline. Email sends will try to upload it to Firebase/Blob first; configure FIREBASE_* or BLOB_READ_WRITE_TOKEN for durable public URLs.",
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
