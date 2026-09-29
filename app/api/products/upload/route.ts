import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { canvasPathFromFirebaseUrl } from "../../../../lib/canvas-firebase-storage";
import { persistPublicMediaFile } from "../../../../lib/public-media-upload";
import { readOverrides, writeOverrides } from "../../../../lib/product-db";
import { getAdminProduct } from "../../../../lib/product-catalog-admin";

export const runtime = "nodejs";

async function requireAdmin() {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (session?.role !== "admin") throw new Error("Admin sign-in required.");
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await request.json();
      if (body.action === "attach-video") {
        await requireAdmin();
        const productId = String(body.productId ?? "");
        if (!(await getAdminProduct(productId))) throw new Error("Unknown product.");
        const url = String(body.url ?? "").trim();
        const objectPath = canvasPathFromFirebaseUrl(url);
        if (!objectPath || !objectPath.startsWith(`admin-product-videos/${productId}/`)) {
          throw new Error("Invalid product video.");
        }
        if (!/\.mp4$/i.test(objectPath)) {
          throw new Error("Product videos must be uploaded as MP4 files.");
        }
        const store = await readOverrides();
        store.overrides[productId] = {
          ...store.overrides[productId],
          videos: [url],
          updatedAt: new Date().toISOString(),
        };
        await writeOverrides(store);
        return NextResponse.json({ videos: [url] });
      }
      return NextResponse.json(
        { error: "Large files now upload through Firebase Storage." },
        { status: 410 }
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Video upload failed." },
        { status: 400 }
      );
    }
  }
  try {
    await requireAdmin();
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

    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "");
    const slot = String(formData.get("slot") ?? "main").toLowerCase();
    const { url: publicPath } = await persistPublicMediaFile(file, `admin-products/${safeId}`);
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
    if (slot === "video" && /admin-products\/[^/]+-video-.*\.bin$/i.test(nextImageUrl || "")) {
      nextImageUrl = undefined;
    }

    store.overrides[productId] = {
      ...existing,
      imageUrl: nextImageUrl,
      images: nextImages,
      videos: nextVideos,
      updatedAt: new Date().toISOString(),
    };
    await writeOverrides(store);

    return NextResponse.json({
      productId,
      slot,
      imageUrl: publicPath,
      allImages: nextImages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload product image.";
    if (message === "Admin sign-in required.") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (/Firebase Storage is not configured/i.test(message)) {
      return NextResponse.json(
        { error: "Image storage is not configured. Check Firebase Storage env vars." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to upload product image." }, { status: 500 });
  }
}
