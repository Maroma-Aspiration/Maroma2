import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { persistPublicMediaFile } from "../../../../lib/public-media-upload";
import { registerSiteMediaItem } from "../../../../lib/site-media-gallery-store";

export const runtime = "nodejs";

const uploadDir = path.join(process.cwd(), "public", "staging-media", "site-gallery");

async function persistImage(file: File): Promise<{ url: string; filename: string }> {
  return persistPublicMediaFile(file, "site-gallery", {
    dir: uploadDir,
    urlPrefix: "/staging-media/site-gallery",
  });
}

async function requireAdmin(): Promise<boolean> {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  return session?.role === "admin";
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    const label = String(formData.get("label") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
    }

    const { url, filename } = await persistImage(file);

    const item = await registerSiteMediaItem({
      url,
      filename,
      label: label || file.name,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload image.";
    if (/Firebase Storage is not configured|quota exceeded|BLOB_READ_WRITE_TOKEN/i.test(message)) {
      return NextResponse.json(
        { error: "Image storage is not configured. Check Firebase Storage env vars." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to upload image." }, { status: 500 });
  }
}
