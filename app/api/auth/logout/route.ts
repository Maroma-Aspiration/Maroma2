import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "../../../../lib/auth-session";

function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

export async function GET(request: Request) {
  clearSessionCookie();
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/login", url.origin));
}

export async function POST() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
