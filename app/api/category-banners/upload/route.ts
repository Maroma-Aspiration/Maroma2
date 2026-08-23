import { put } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { catalogCategories } from "../../../../lib/catalog-categories";
import { readCategoryBannerStore, writeCategoryBannerStore } from "../../../../lib/category-banner-store";
import { registerSiteMediaItem } from "../../../../lib/site-media-gallery-store";

export const runtime = "nodejs";

const uploadDir = path.join(process.cwd(), "public", "staging-media", "admin-category-banners");

const extensionForMime = (mime: string): string => {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return ".bin";
};

const validSlug = (slug: string): boolean =>
  catalogCategories.some((category) => category.slug === slug);

const blobConfigured = (): boolean => Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

async function persistImage(
  file: File,
  fileName: string
): Promise<{ url: string; filename: string }> {
  if (blobConfigured() || process.env.VERCEL) {
    const uploaded = await put(`admin-category-banners/${fileName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      cacheControlMaxAge: 31536000,
    });
    const filename = uploaded.pathname.split("/").pop() ?? fileName;
    return { url: uploaded.url, filename };
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const fullPath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);
  return {
    url: `/staging-media/admin-category-banners/${fileName}`,
    filename: fileName,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const slug = String(formData.get("slug") ?? "").trim();
    const target = String(formData.get("target") ?? "hero").trim();
    const file = formData.get("image");

    if (!slug || !validSlug(slug)) {
      return NextResponse.json({ error: "Unknown or missing category slug." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "image file is required." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
    }

    const ext = extensionForMime(file.type);
    const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
    const fileName = `${safeSlug}-${Date.now()}${ext}`;
    const { url: publicPath } = await persistImage(file, fileName);

    const store = await readCategoryBannerStore();
    const prev = store.banners[slug] ?? {};
    store.banners[slug] = {
      ...prev,
      ...(target === "card" ? { cardImageUrl: publicPath } : { imageUrl: publicPath }),
      updatedAt: new Date().toISOString(),
    };
    await writeCategoryBannerStore(store);

    await registerSiteMediaItem({
      url: publicPath,
      filename: fileName,
      label: `${slug} ${target === "card" ? "collection card" : "banner"}`,
      tags: ["category", slug, target],
    });

    return NextResponse.json({
      slug,
      imageUrl: publicPath,
      cardImageUrl: target === "card" ? publicPath : undefined,
      target,
    });
  } catch {
    return NextResponse.json({ error: "Unable to upload category banner." }, { status: 500 });
  }
}
