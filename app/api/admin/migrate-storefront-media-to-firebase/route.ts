import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { migrateStorefrontMediaToFirebase } from "../../../../lib/migrate-storefront-media-to-firebase";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const secret = getSessionSecret();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  try {
    const result = await migrateStorefrontMediaToFirebase(force);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Migration failed.";
    console.error("[migrate-storefront-media-to-firebase]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
