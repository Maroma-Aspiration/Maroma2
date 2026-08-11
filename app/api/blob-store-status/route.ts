import { NextResponse } from "next/server";
import { probeCanvasBlobReadable } from "../../../lib/canvas-legacy-blob";
import { isCanvasFirebaseConfigured, probeCanvasFirebaseReadable } from "../../../lib/canvas-firebase-storage";

const SAMPLE_LEGACY_BLOB =
  "https://gncn27oahij4ancd.public.blob.vercel-storage.com/canvas/1780848530936-aqlxwaea1hk.png";

export async function GET() {
  const firebaseConfigured = isCanvasFirebaseConfigured();
  const firebaseReadable = firebaseConfigured ? await probeCanvasFirebaseReadable() : false;
  const legacyBlobReadable = await probeCanvasBlobReadable(SAMPLE_LEGACY_BLOB);

  const ok = firebaseConfigured ? firebaseReadable : legacyBlobReadable;

  let message: string;
  if (firebaseConfigured && firebaseReadable) {
    message = "Firebase Storage is configured and reachable for canvas images.";
  } else if (firebaseConfigured) {
    message =
      "Firebase is configured but the storage bucket is not reachable. Check FIREBASE_STORAGE_BUCKET and service account permissions.";
  } else if (legacyBlobReadable) {
    message =
      "Legacy Vercel Blob is still readable. Configure Firebase env vars and run the migration API to move canvas images.";
  } else {
    message =
      "Canvas images are unavailable. Configure Firebase Storage (FIREBASE_* env vars) or reactivate the legacy Vercel Blob store.";
  }

  return NextResponse.json({
    ok,
    storage: firebaseConfigured ? "firebase" : "legacy-blob",
    firebaseConfigured,
    firebaseReadable,
    legacyBlobReadable,
    message,
  });
}
