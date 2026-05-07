import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!secret || !token) {
    return NextResponse.json({ user: null });
  }
  const payload = await verifySessionPayload(token, secret);
  if (!payload) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: { email: payload.email, role: payload.role } });
}
