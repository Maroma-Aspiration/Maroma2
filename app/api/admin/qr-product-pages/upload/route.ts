import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../lib/auth-session";
import { persistPublicMediaFile } from "../../../../../lib/public-media-upload";

export const runtime = "nodejs";

async function requireAdmin() {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  return session?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Choose an image or video." }, { status: 400 });
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return NextResponse.json({ error: "Only image and video files are supported." }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Use browser upload for files over 4MB." },
      { status: 413 }
    );
  }
  try {
    const { url } = await persistPublicMediaFile(file, "qr-product-guides");
    return NextResponse.json({ url, type: file.type });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Upload failed. Check Firebase Storage env vars.",
      },
      { status: 500 }
    );
  }
}
