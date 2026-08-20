import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import {
  deleteStoreLocation,
  readStoreLocator,
  upsertStoreLocation,
  type StoreLocation,
} from "../../../lib/store-locator-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStoreLocator();
  return NextResponse.json({ locations: store.locations });
}

export async function POST(request: Request) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.deleteId === "string") {
    await deleteStoreLocation(body.deleteId);
    const store = await readStoreLocator();
    return NextResponse.json({ ok: true, locations: store.locations });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const location = await upsertStoreLocation({
    ...(body as Partial<StoreLocation>),
    name,
    lat: body.lat === "" || body.lat == null ? null : Number(body.lat),
    lng: body.lng === "" || body.lng == null ? null : Number(body.lng),
  });
  return NextResponse.json({ location });
}
