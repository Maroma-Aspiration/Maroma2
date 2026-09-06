import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { head } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { readOverrides, writeOverrides } from "../../../../lib/product-db";
import { getAdminProduct } from "../../../../lib/product-catalog-admin";

const extensionForMime = (mime: string): string => {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return ".bin";
};

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await request.json();
      const requireAdmin = async () => {
        const secret = getSessionSecret();
        const token = cookies().get(SESSION_COOKIE)?.value;
        const session = secret && token ? await verifySessionPayload(token, secret) : null;
        if (session?.role !== "admin") throw new Error("Admin sign-in required.");
      };
      if (body.action === "attach-video") {
        await requireAdmin();
        const productId = String(body.productId ?? "");
        if (!(await getAdminProduct(productId))) throw new Error("Unknown product.");
        const blob = await head(String(body.url ?? ""));
        if (!blob.pathname.startsWith(`admin-product-videos/${productId}/`) || !["video/mp4", "video/webm"].includes(blob.contentType)) throw new Error("Invalid product video.");
        const store = await readOverrides();
        store.overrides[productId] = { ...store.overrides[productId], videos: [blob.url], updatedAt: new Date().toISOString() };
        await writeOverrides(store);
        return NextResponse.json({ videos: [blob.url] });
      }
      const result = await handleUpload({ body, request,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          await requireAdmin();
          const productId = String(JSON.parse(clientPayload || "{}").productId ?? "");
          if (!/^[a-zA-Z0-9_-]+$/.test(productId) || !pathname.startsWith(`admin-product-videos/${productId}/`) || !(await getAdminProduct(productId))) throw new Error("Invalid product.");
          return { allowedContentTypes: ["video/mp4", "video/webm"], maximumSizeInBytes: 100 * 1024 * 1024, addRandomSuffix: true };
        },
        onUploadCompleted: async () => {},
      });
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Video upload failed." }, { status: 400 });
    }
  }
  try {
    const formData = await request.formData();
    const productId = String(formData.get("productId") ?? "").trim();
    const file = formData.get("image");

    if (!productId) {
      return NextResponse.json({ error: "productId is required." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "image file is required." }, { status: 400 });
    }

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only image and video uploads are supported." }, { status: 400 });
    }

    const exists = Boolean(await getAdminProduct(productId));
    if (!exists) {
      return NextResponse.json({ error: "Unknown product id." }, { status: 404 });
    }

    const ext = extensionForMime(file.type);
    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "");
    const slot = String(formData.get("slot") ?? "main").toLowerCase();
    const fileName = `admin-products/${safeId}-${slot}-${Date.now()}${ext}`;
    const uploaded = await put(fileName, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      cacheControlMaxAge: 31536000,
    });
    const publicPath = uploaded.url;
    const store = await readOverrides();
    const existing = store.overrides[productId] || { images: [], updatedAt: "" };
    
    const nextImages = [...(existing.images || [])];
    let nextImageUrl = existing.imageUrl;

    if (slot === "main") {
      nextImageUrl = publicPath;
      nextImages[0] = publicPath;
    } else if (slot === "view1") {
      nextImages[1] = publicPath;
    } else if (slot === "view2") {
      nextImages[2] = publicPath;
    } else if (slot === "view3") {
      nextImages[3] = publicPath;
    } else if (slot === "view4") {
      nextImages[4] = publicPath;
    }

    const nextVideos = slot === "video" ? [publicPath] : existing.videos;
    // A previous video upload was incorrectly promoted to the main image.
    // Clear that legacy value so the product's actual primary photo is used.
    if (slot === "video" && /admin-products\/[^/]+-video-.*\.bin$/i.test(nextImageUrl || "")) {
      nextImageUrl = undefined;
    }

    store.overrides[productId] = {
      ...existing,
      imageUrl: nextImageUrl,
      images: nextImages,
      videos: nextVideos,
      updatedAt: new Date().toISOString()
    };
    await writeOverrides(store);

    return NextResponse.json({
      productId,
      slot,
      imageUrl: publicPath,
      allImages: nextImages
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to upload product image." },
      { status: 500 }
    );
  }
}
