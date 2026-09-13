import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import {
  createFirebaseDirectUpload,
  ensureFirebaseUploadCors,
  isCanvasFirebaseConfigured,
} from "../../../../lib/canvas-firebase-storage";

export const runtime = "nodejs";

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
  if (!isCanvasFirebaseConfigured()) {
    return NextResponse.json({ error: "Firebase Storage is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as { path?: string; contentType?: string };
  const rawPath = String(body.path ?? "").replace(/^\/+/, "");
  const contentType = String(body.contentType ?? "application/octet-stream");
  const allowedPrefix = [
    "site-gallery/",
    "admin-promo-strip-bg/",
    "homepage-promo/",
    "admin-category-banners/",
    "admin-products/",
    "admin-product-videos/",
    "qr-product-guides/",
    "canvas/",
  ].some((prefix) => rawPath.startsWith(prefix));
  if (
    !rawPath ||
    rawPath.includes("..") ||
    rawPath.length > 220 ||
    !/^[a-zA-Z0-9._/-]+$/.test(rawPath) ||
    !allowedPrefix
  ) {
    return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
  }

  await ensureFirebaseUploadCors();
  const target = await createFirebaseDirectUpload(rawPath, contentType);
  return NextResponse.json({ ...target, contentType });
}
