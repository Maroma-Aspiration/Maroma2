import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { catalogCategories } from "../../../lib/catalog-categories";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import type { CategoryBannerOverride } from "../../../lib/category-banner-types";
import { readCategoryBannerStore, writeCategoryBannerStore } from "../../../lib/category-banner-store";

export const runtime = "nodejs";
export const maxDuration = 120;

async function requireAdmin(): Promise<boolean> {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  return session?.role === "admin";
}

const validSlug = (slug: string): boolean =>
  catalogCategories.some((category) => category.slug === slug);

export async function GET() {
  const store = await readCategoryBannerStore();
  return NextResponse.json(store);
}

type PostBody = {
  slug?: string;
  patch?: CategoryBannerOverride;
  reset?: boolean;
  resetCard?: boolean;
};

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
    }
    const body = (await request.json()) as PostBody;
    const slug = String(body.slug ?? "").trim();
    if (!slug || !validSlug(slug)) {
      return NextResponse.json({ error: "Unknown or missing category slug." }, { status: 400 });
    }

    const store = await readCategoryBannerStore();

    if (body.reset === true) {
      delete store.banners[slug];
      await writeCategoryBannerStore(store);
      revalidatePath(`/${slug}`);
      revalidatePath("/");
      return NextResponse.json({ ok: true, banners: store.banners });
    }

    if (body.resetCard === true) {
      const prev = store.banners[slug];
      if (prev) {
        const {
          cardLabel: _cl,
          cardDescription: _cd,
          cardImageUrl: _ci,
          cardObjectPosition: _cp,
          cardBackgroundScale: _cs,
          ...rest
        } = prev;
        store.banners[slug] = { ...rest, updatedAt: new Date().toISOString() };
      }
      await writeCategoryBannerStore(store);
      revalidatePath(`/${slug}`);
      revalidatePath("/");
      return NextResponse.json({ ok: true, banner: store.banners[slug] ?? null });
    }

    const patch = body.patch ?? {};
    const prev = store.banners[slug] ?? {};
    const merged: CategoryBannerOverride = {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    if (merged.thumbMaxWidth !== undefined) {
      merged.thumbMaxWidth = Math.min(560, Math.max(120, Math.round(merged.thumbMaxWidth)));
    }
    if (typeof merged.objectPosition === "string") {
      merged.objectPosition = merged.objectPosition.trim();
    }
    if (merged.imageScale !== undefined) {
      merged.imageScale = Math.min(300, Math.max(50, Math.round(merged.imageScale)));
    }
    if (typeof merged.minHeight === "string") {
      merged.minHeight = merged.minHeight.trim();
    }
    if (typeof merged.maxHeight === "string") {
      merged.maxHeight = merged.maxHeight.trim();
    }
    if (typeof merged.cardLabel === "string") {
      merged.cardLabel = merged.cardLabel.trim();
    }
    if (typeof merged.cardDescription === "string") {
      merged.cardDescription = merged.cardDescription.trim();
    }
    if (typeof merged.cardImageUrl === "string") {
      merged.cardImageUrl = merged.cardImageUrl.trim();
    }
    if (typeof merged.cardObjectPosition === "string") {
      merged.cardObjectPosition = merged.cardObjectPosition.trim();
    }
    if (merged.cardBackgroundScale !== undefined) {
      merged.cardBackgroundScale = Math.min(300, Math.max(50, Math.round(merged.cardBackgroundScale)));
    }
    if (merged.copyLeftPct !== undefined) {
      merged.copyLeftPct = Math.min(90, Math.max(0, Math.round(merged.copyLeftPct)));
    }
    if (merged.copyBottomPct !== undefined) {
      merged.copyBottomPct = Math.min(90, Math.max(0, Math.round(merged.copyBottomPct)));
    }

    store.banners[slug] = merged;
    await writeCategoryBannerStore(store);
    revalidatePath(`/${slug}`);
    revalidatePath("/");
    return NextResponse.json({ ok: true, banner: merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update category banner.";
    console.error("[category-banners] save failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
