import { handleUpload } from "@vercel/blob/client";
import { put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { registerSiteMediaItem } from "../../../../lib/site-media-gallery-store";

export const runtime = "nodejs";

const uploadDir = path.join(process.cwd(), "public", "staging-media", "admin-promo-strip-bg");

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const SERVER_FORM_MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/ogg",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv"]);

function extensionForFile(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/jpeg" || mime === "image/jpg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/quicktime") return ".mov";
  if (mime === "video/x-m4v") return ".m4v";
  if (mime === "video/ogg") return ".ogv";

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return `.${ext}`;
  return ".bin";
}

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

const blobConfigured = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

async function persistMedia(
  file: File,
  fileName: string
): Promise<{ url: string; filename: string }> {
  if (blobConfigured() || process.env.VERCEL) {
    const uploaded = await put(`admin-promo-strip-bg/${fileName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || undefined,
      cacheControlMaxAge: 31536000,
    });
    const filename = uploaded.pathname.split("/").pop() ?? fileName;
    return { url: uploaded.url, filename };
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const fullPath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);
  return {
    url: `/staging-media/admin-promo-strip-bg/${fileName}`,
    filename: fileName,
  };
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 31536000,
        }),
        onUploadCompleted: async ({ blob }) => {
          const kind = blob.contentType?.startsWith("video/") ? "video" : "image";
          await registerSiteMediaItem({
            url: blob.url,
            filename: blob.pathname.split("/").pop() ?? blob.pathname,
            label: blob.pathname,
            tags: ["promo-strip", kind],
          });
        },
      });
      return NextResponse.json(jsonResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload promo strip background.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const requestedKind = String(formData.get("mediaKind") ?? "").trim().toLowerCase();

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

    const safeBase = (file.name.replace(/\.[^.]+$/, "") || mediaKind)
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .toLowerCase();
    const fileName = `${safeBase || mediaKind}-${Date.now()}${extensionForFile(file)}`;
    const { url, filename } = await persistMedia(file, fileName);

    await registerSiteMediaItem({
      url,
      filename,
      label: file.name || `Promo strip ${mediaKind}`,
      tags: ["promo-strip", mediaKind],
    });

    return NextResponse.json({
      ok: true,
      url,
      mediaKind,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload promo strip background.";
    if (/BLOB_READ_WRITE_TOKEN|No token found|store has been suspended/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Media storage is not configured. Set BLOB_READ_WRITE_TOKEN or run locally with public/staging-media.",
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
