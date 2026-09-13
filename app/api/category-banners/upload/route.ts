import path from "path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { catalogCategories } from "../../../../lib/catalog-categories";
import type { CategoryBannerOverride } from "../../../../lib/category-banner-types";
import { readCategoryBannerStore, writeCategoryBannerStore } from "../../../../lib/category-banner-store";
import { persistPublicMediaFile } from "../../../../lib/public-media-upload";
import { registerSiteMediaItem } from "../../../../lib/site-media-gallery-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const uploadDir = path.join(process.cwd(), "public", "staging-media", "admin-category-banners");

const validSlug = (slug: string): boolean =>
  catalogCategories.some((category) => category.slug === slug);

function normalisePatch(patch: CategoryBannerOverride): CategoryBannerOverride {
  const next = { ...patch };
  if (next.thumbMaxWidth !== undefined) next.thumbMaxWidth = Math.min(560, Math.max(120, Math.round(next.thumbMaxWidth)));
  if (next.imageScale !== undefined) next.imageScale = Math.min(300, Math.max(50, Math.round(next.imageScale)));
  if (next.cardBackgroundScale !== undefined) next.cardBackgroundScale = Math.min(300, Math.max(50, Math.round(next.cardBackgroundScale)));
  for (const key of ["objectPosition", "minHeight", "maxHeight", "cardLabel", "cardDescription", "cardImageUrl", "cardObjectPosition"] as const) {
    if (typeof next[key] === "string") next[key] = next[key]?.trim();
  }
  return next;
}

async function requireAdmin(): Promise<boolean> {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  return session?.role === "admin";
}

async function persistImage(file: File): Promise<{ url: string; filename: string }> {
  return persistPublicMediaFile(file, "admin-category-banners", {
    dir: uploadDir,
    urlPrefix: "/staging-media/admin-category-banners",
  });
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
    }
    const formData = await request.formData();
    const slug = String(formData.get("slug") ?? "").trim();
    const target = String(formData.get("target") ?? "hero").trim();
    const file = formData.get("image");
    const patchValue = formData.get("patch");
    let patch: CategoryBannerOverride = {};
    if (typeof patchValue === "string" && patchValue.trim()) {
      try {
        patch = normalisePatch(JSON.parse(patchValue) as CategoryBannerOverride);
      } catch {
        return NextResponse.json({ error: "Banner changes could not be read." }, { status: 400 });
      }
    }

    if (!slug || !validSlug(slug)) {
      return NextResponse.json({ error: "Unknown or missing category slug." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "image file is required." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
    }

    const { url: publicPath, filename } = await persistImage(file);

    const store = await readCategoryBannerStore();
    const prev = store.banners[slug] ?? {};
    store.banners[slug] = {
      ...prev,
      ...patch,
      ...(target === "card" ? { cardImageUrl: publicPath } : { imageUrl: publicPath }),
      updatedAt: new Date().toISOString(),
    };
    await writeCategoryBannerStore(store);

    try {
      await registerSiteMediaItem({
        url: publicPath,
        filename,
        label: `${slug} ${target === "card" ? "collection card" : "banner"}`,
        tags: ["category", slug, target],
      });
    } catch (error) {
      console.error("[category-banners] gallery register failed", error);
    }

    revalidatePath(`/${slug}`);
    revalidatePath("/");

    return NextResponse.json({
      slug,
      imageUrl: publicPath,
      cardImageUrl: target === "card" ? publicPath : undefined,
      target,
      banner: store.banners[slug],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload category banner.";
    console.error("[category-banners] upload failed", error);
    if (/Firebase Storage is not configured|quota exceeded|BLOB_READ_WRITE_TOKEN/i.test(message)) {
      return NextResponse.json(
        { error: "Image storage is not configured. Check Firebase Storage env vars." },
        { status: 503 }
      );
    }
    if (/request entity too large|body exceeded|413/i.test(message)) {
      return NextResponse.json(
        { error: "That image is too large to upload. Try a JPEG or PNG under 4MB." },
        { status: 413 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
