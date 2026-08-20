import { NextResponse } from "next/server";
import { readGift3dAssetsStore, toPublicGift3dAssets } from "../../../lib/gift-3d-assets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public approved reconstructed meshes for the gift-builder 3D scene. */
export async function GET() {
  try {
    const store = await readGift3dAssetsStore();
    return NextResponse.json({ assets: toPublicGift3dAssets(store) });
  } catch (error) {
    console.error("gift-3d-assets GET failed", error);
    return NextResponse.json({ assets: {} });
  }
}
