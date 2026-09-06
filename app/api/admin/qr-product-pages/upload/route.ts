import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { put } from "@vercel/blob";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../lib/auth-session";

export const runtime = "nodejs";
async function requireAdmin() { const secret = getSessionSecret(); const token = cookies().get(SESSION_COOKIE)?.value; const session = secret && token ? await verifySessionPayload(token, secret) : null; return session?.role === "admin"; }
export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose an image or video." }, { status: 400 });
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) return NextResponse.json({ error: "Only image and video files are supported." }, { status: 400 });
  if (file.size > 70 * 1024 * 1024) return NextResponse.json({ error: "Media must be 70 MB or smaller." }, { status: 400 });
  try { const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-"); const blob = await put(`qr-product-guides/${Date.now()}-${safeName}`, file, { access: "public", addRandomSuffix: true }); return NextResponse.json({ url: blob.url, type: file.type }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed. Configure Vercel Blob for durable media." }, { status: 500 }); }
}
