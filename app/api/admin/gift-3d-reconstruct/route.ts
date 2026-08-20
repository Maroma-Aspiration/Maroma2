import { NextResponse } from "next/server";
import {
  emptyGift3dProductAsset,
  readGift3dAssetsStore,
  writeGift3dAssetsStore,
  type Gift3dProductAsset,
} from "../../../../lib/gift-3d-assets-store";
import {
  HUNYUAN_IMAGE_TO_3D,
  isGift3dReconstructConfigured,
  reconstructGift3dMesh,
} from "../../../../lib/gift-3d-reconstruct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({
    configured: isGift3dReconstructConfigured(),
    provider: HUNYUAN_IMAGE_TO_3D,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { productId?: string; catalogImageUrl?: string };
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) {
      return NextResponse.json({ error: "productId is required." }, { status: 400 });
    }

    const store = await readGift3dAssetsStore();
    const existing = store.products[productId] ?? emptyGift3dProductAsset(productId);
    const running: Gift3dProductAsset = {
      ...existing,
      reconstructionStatus: "running",
      reconstructionError: undefined,
      updatedAt: new Date().toISOString(),
    };
    let nextStore = await writeGift3dAssetsStore({
      ...store,
      products: { ...store.products, [productId]: running },
    });

    try {
      const mesh = await reconstructGift3dMesh(running, body.catalogImageUrl);
      const ready: Gift3dProductAsset = {
        ...nextStore.products[productId],
        ...mesh,
        reconstructionStatus: "ready",
        reconstructionError: undefined,
        reconstructedAt: new Date().toISOString(),
        status: nextStore.products[productId].status === "approved" ? "approved" : "draft",
        updatedAt: new Date().toISOString(),
      };
      nextStore = await writeGift3dAssetsStore({
        ...nextStore,
        products: { ...nextStore.products, [productId]: ready },
      });
      return NextResponse.json({ store: nextStore });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mesh generation failed.";
      console.error("gift-3d-reconstruct failed", error);
      const failed: Gift3dProductAsset = {
        ...nextStore.products[productId],
        reconstructionStatus: "failed",
        reconstructionError: message,
        updatedAt: new Date().toISOString(),
      };
      nextStore = await writeGift3dAssetsStore({
        ...nextStore,
        products: { ...nextStore.products, [productId]: failed },
      });
      const status = /FAL_KEY is not set/i.test(message) ? 503 : 502;
      return NextResponse.json({ error: message, store: nextStore }, { status });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reconstruct 3D mesh." },
      { status: 400 }
    );
  }
}
