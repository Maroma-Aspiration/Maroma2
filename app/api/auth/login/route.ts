import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSessionSecret,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  signSessionPayload
} from "../../../../lib/auth-session";
import { authenticateCredentialsAsync } from "../../../../lib/auth-user-store";

export async function POST(request: Request) {
  const secret = getSessionSecret();
  if (!secret) {
    return NextResponse.json({ error: "Authentication is not configured on the server." }, { status: 503 });
  }

  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const user = await authenticateCredentialsAsync(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const exp = Date.now() + SESSION_DURATION_MS;
  const token = await signSessionPayload({ email: user.email, role: user.role, exp }, secret);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  });

  return NextResponse.json({ ok: true, email: user.email, role: user.role });
}
