import { NextResponse } from "next/server";
import { readGiftPackingStore, writeGiftPackingStore, type GiftPackingStore } from "../../../../lib/gift-packing-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() { return NextResponse.json(await readGiftPackingStore()); }
export async function PUT(request: Request) {
  try { return NextResponse.json(await writeGiftPackingStore(await request.json() as GiftPackingStore)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save gift packing." }, { status: 400 }); }
}
