import { NextResponse } from "next/server";
import { PREVIEW_COOKIE, previewAccessToken } from "../../../lib/preview-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.MAROMA_PREVIEW_PASSWORD;
  if (!expected) return NextResponse.json({ error: "Preview access is not configured." }, { status: 503 });
  let password = "";
  try { password = String((await request.json()).password ?? ""); } catch {}
  if (password !== expected) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PREVIEW_COOKIE, await previewAccessToken(expected), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

