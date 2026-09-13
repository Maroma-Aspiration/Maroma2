import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { persistPublicMediaFile } from "../../../../lib/public-media-upload";
import { registerSiteMediaItem } from "../../../../lib/site-media-gallery-store";

export const runtime = "nodejs";

const uploadDir = path.join(process.cwd(), "public", "staging-media", "admin-promo-strip-bg");

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const SERVER_FORM_MAX_BYTES = 4 * 1024 * 1024;

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv"]);

function resolveMediaKind(file: File, requested: string): "image" | "video" | null {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() ?? "")) {
    return "video";
  }
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (requested === "video" || requested === "image") {
    return requested;
  }
  return null;
}

async function persistMedia(file: File): Promise<{ url: string; filename: string }> {
  return persistPublicMediaFile(file, "admin-promo-strip-bg", {
    dir: uploadDir,
    urlPrefix: "/staging-media/admin-promo-strip-bg",
  });
}

async function requireAdmin(): Promise<boolean> {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  return session?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Large files now upload through Firebase Storage." },
      { status: 410 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedKind = String(formData.get("mediaKind") ?? "").trim().toLowerCase();
    // Direct uploads from the promo editor stay out of the shared media gallery.
    const skipGallery = String(formData.get("skipGallery") ?? "") === "1";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const mediaKind = resolveMediaKind(file, requestedKind);
    if (!mediaKind) {
      return NextResponse.json(
        { error: "Only image or video uploads are supported for the promo strip background." },
        { status: 400 }
      );
    }

    if (requestedKind === "video" && mediaKind !== "video") {
      return NextResponse.json({ error: "Choose a video file (MP4, WebM, or MOV)." }, { status: 400 });
    }

    if (requestedKind === "image" && mediaKind !== "image") {
      return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
    }

    const maxBytes = mediaKind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      const maxMb = Math.round(maxBytes / (1024 * 1024));
      return NextResponse.json(
        {
          error: `File is too large. Promo strip ${mediaKind}s must be under ${maxMb}MB.`,
        },
        { status: 413 }
      );
    }

    if (file.size > SERVER_FORM_MAX_BYTES) {
      return NextResponse.json(
        {
          error:
            "File is too large for direct upload. Use Load video (browser upload) for clips over 4MB.",
        },
        { status: 413 }
      );
    }

    const { url, filename } = await persistMedia(file);

    if (!skipGallery) {
      await registerSiteMediaItem({
        url,
        filename,
        label: file.name || `Promo strip ${mediaKind}`,
        tags: ["promo-strip", mediaKind],
      });
    }

    return NextResponse.json({
      ok: true,
      url,
      mediaKind,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload promo strip background.";
    if (/Firebase Storage is not configured|quota exceeded|BLOB_READ_WRITE_TOKEN/i.test(message)) {
      return NextResponse.json(
        {
          error: "Media storage is not configured. Check Firebase Storage env vars.",
        },
        { status: 503 }
      );
    }
    if (/request entity too large|body exceeded|413/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Upload was rejected by the server (file too large). Use Load video for clips over 4MB.",
        },
        { status: 413 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
