import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import {
  deletePromoBanner,
  listLivePromoBanners,
  readPromoStore,
  upsertPromoBanner,
  type PromoAnimation,
  type PromoMediaKind,
} from "../../../lib/promo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("admin") === "1") {
    const secret = getSessionSecret();
    const token = cookies().get(SESSION_COOKIE)?.value;
    const session = secret && token ? await verifySessionPayload(token, secret) : null;
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
    }
    const store = await readPromoStore();
    return NextResponse.json({ banners: store.banners });
  }
  const banners = await listLivePromoBanners();
  return NextResponse.json({ banners });
}

async function requireAdmin() {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || session.role !== "admin") {
    return null;
  }
  return session;
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.deleteId && typeof body.deleteId === "string") {
    await deletePromoBanner(body.deleteId);
    const store = await readPromoStore();
    return NextResponse.json({ ok: true, banners: store.banners });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  const banner = await upsertPromoBanner({
    id: typeof body.id === "string" ? body.id : undefined,
    title,
    body: typeof body.body === "string" ? body.body : "",
    mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : "",
    mediaKind: body.mediaKind as PromoMediaKind,
    animation: body.animation as PromoAnimation,
    ctaLabel: typeof body.ctaLabel === "string" ? body.ctaLabel : "",
    ctaHref: typeof body.ctaHref === "string" ? body.ctaHref : "",
    startsAt: typeof body.startsAt === "string" ? body.startsAt : "",
    endsAt: typeof body.endsAt === "string" ? body.endsAt : "",
    active: body.active !== false,
  });
  return NextResponse.json({ banner });
}
