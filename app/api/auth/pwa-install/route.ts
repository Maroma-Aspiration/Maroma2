import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { hasAccountInstalledPwa, markAccountPwaInstalled } from "../../../../lib/pwa-install-store";

export const dynamic = "force-dynamic";

async function accountEmail(): Promise<string | null> {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!secret || !token) return null;
  return (await verifySessionPayload(token, secret))?.email ?? null;
}

export async function GET() {
  const email = await accountEmail();
  if (!email) return NextResponse.json({ installed: false }, { status: 401 });
  return NextResponse.json({ installed: await hasAccountInstalledPwa(email) });
}

export async function POST() {
  const email = await accountEmail();
  if (!email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  await markAccountPwaInstalled(email);
  return NextResponse.json({ installed: true });
}
