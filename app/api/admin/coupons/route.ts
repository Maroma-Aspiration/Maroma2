import { NextResponse } from "next/server";
import { deleteCoupon, listCoupons, upsertCoupon } from "../../../../lib/commerce-coupons";
import type { CouponRecord } from "../../../../lib/commerce-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const coupons = await listCoupons();
  return NextResponse.json({ ok: true, coupons });
}

export async function POST(request: Request) {
  let body: Partial<CouponRecord> = {};
  try {
    body = (await request.json()) as Partial<CouponRecord>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const type = body.type;
  const value = typeof body.value === "number" ? body.value : NaN;
  if (!code || (type !== "percent" && type !== "fixed") || !Number.isFinite(value)) {
    return NextResponse.json({ error: "code, type, and value are required." }, { status: 400 });
  }

  try {
    const coupon = await upsertCoupon({
      code,
      type,
      value,
      minSubtotal: typeof body.minSubtotal === "number" ? body.minSubtotal : undefined,
      active: body.active !== false,
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, coupon });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save coupon.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "code is required." }, { status: 400 });
  }
  const removed = await deleteCoupon(code);
  if (!removed) {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
