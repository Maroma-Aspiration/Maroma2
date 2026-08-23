import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import type { PromoFrame, PromoPresentation, PromoSequenceTransition } from "../../../lib/promo-types";
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
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
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
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || session.role !== "admin") {
    return null;
  }
  return session;
}

function normalizeScheduleValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString();
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
  if (body.unpublishId && typeof body.unpublishId === "string") {
    const store = await readPromoStore();
    const existing = store.banners.find((banner) => banner.id === body.unpublishId);
    if (!existing) {
      return NextResponse.json({ error: "Banner not found." }, { status: 404 });
    }
    const banner = await upsertPromoBanner({ ...existing, active: false });
    return NextResponse.json({ ok: true, banner });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  const publishNow = body.publishNow === true;
  const active =
    publishNow ? true : typeof body.active === "boolean" ? body.active : body.active !== false;
  const banner = await upsertPromoBanner({
    id: typeof body.id === "string" ? body.id : undefined,
    title,
    body: typeof body.body === "string" ? body.body : "",
    mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : "",
    mediaKind: body.mediaKind as PromoMediaKind,
    animation: body.animation as PromoAnimation,
    ctaLabel: typeof body.ctaLabel === "string" ? body.ctaLabel : "",
    ctaHref: typeof body.ctaHref === "string" ? body.ctaHref : "",
    presentation: body.presentation as PromoPresentation,
    sequenceTransition: body.sequenceTransition as PromoSequenceTransition,
    sequenceLoop: typeof body.sequenceLoop === "boolean" ? body.sequenceLoop : undefined,
    frames: Array.isArray(body.frames) ? (body.frames as PromoFrame[]) : undefined,
    stripBackground: typeof body.stripBackground === "string" ? body.stripBackground : undefined,
    stripHeightPx: typeof body.stripHeightPx === "number" ? body.stripHeightPx : undefined,
    stripOpacity: typeof body.stripOpacity === "number" ? body.stripOpacity : undefined,
    mediaOffsetXCm: typeof body.mediaOffsetXCm === "number" ? body.mediaOffsetXCm : undefined,
    marqueeForceScroll: typeof body.marqueeForceScroll === "boolean" ? body.marqueeForceScroll : undefined,
    heroMarqueeStartOffsetCm:
      typeof body.heroMarqueeStartOffsetCm === "number" ? body.heroMarqueeStartOffsetCm : undefined,
    heroMarqueeStartOffsetPx:
      typeof body.heroMarqueeStartOffsetPx === "number" ? body.heroMarqueeStartOffsetPx : undefined,
    ctaBuyLinks: Array.isArray(body.ctaBuyLinks) ? body.ctaBuyLinks : undefined,
    startsAt: publishNow ? "" : normalizeScheduleValue(body.startsAt),
    endsAt: publishNow ? "" : normalizeScheduleValue(body.endsAt),
    active,
  });
  return NextResponse.json({ ok: true, banner });
}
