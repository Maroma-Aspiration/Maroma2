import { NextResponse } from "next/server";
import { GIFT_BOXES, GIFT_CARD_PRESETS, GIFT_EVENT_PRESETS, GIFT_QUANTITY_TIERS } from "../../../../lib/gift-builder-catalog";
import { enrichGiftElements } from "../../../../lib/gift-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const elements = await enrichGiftElements();
    return NextResponse.json({
      boxes: GIFT_BOXES,
      elements,
      presets: GIFT_EVENT_PRESETS,
      quantityTiers: GIFT_QUANTITY_TIERS,
      cardPresets: GIFT_CARD_PRESETS,
    });
  } catch (error) {
    console.error("gift-builder catalog GET failed", error);
    return NextResponse.json({ error: "Failed to load gift builder catalog." }, { status: 500 });
  }
}
