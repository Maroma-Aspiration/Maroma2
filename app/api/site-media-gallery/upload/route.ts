import { put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { registerSiteMediaItem } from "../../../../lib/site-media-gallery-store";

export const runtime = "nodejs";

const uploadDir = path.join(process.cwd(), "public", "staging-media", "site-gallery");

const extensionForMime = (mime: string): string => {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/svg+xml") return ".svg";
  return ".bin";
};

const blobConfigured = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

async function persistImage(
  file: File,
  fileName: string
): Promise<{ url: string; filename: string }> {
  if (blobConfigured() || process.env.VERCEL) {
    const uploaded = await put(`site-gallery/${fileName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
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
    url: `/staging-media/site-gallery/${fileName}`,
    filename: fileName,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const label = String(formData.get("label") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
    }

    const ext = extensionForMime(file.type);
    const safeBase = (file.name.replace(/\.[^.]+$/, "") || "image")
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .toLowerCase();
    const fileName = `${safeBase || "image"}-${Date.now()}${ext}`;
    const { url, filename } = await persistImage(file, fileName);

    const item = await registerSiteMediaItem({
      url,
      filename,
      label: label || file.name,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload image.";
    if (/BLOB_READ_WRITE_TOKEN|No token found|store has been suspended/i.test(message)) {
      return NextResponse.json(
        { error: "Image storage is not configured. Link Vercel Blob for this project." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to upload image." }, { status: 500 });
  }
}
