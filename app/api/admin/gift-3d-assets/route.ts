import { NextResponse } from "next/server";
import {
  readGift3dAssetsStore,
  writeGift3dAssetsStore,
  type Gift3dAssetsStore,
} from "../../../../lib/gift-3d-assets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readGift3dAssetsStore());
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Gift3dAssetsStore;
    return NextResponse.json(await writeGift3dAssetsStore(body));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save 3D assets." },
      { status: 400 }
    );
  }
}
