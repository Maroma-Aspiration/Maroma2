import { NextResponse } from "next/server";
import { buildCcavenueCheckoutForm, isCcavenueConfigured } from "../../../../../lib/ccavenue";
import { getOrderById, getOrderByNumber } from "../../../../../lib/commerce-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isCcavenueConfigured()) {
    return NextResponse.json({ error: "Online payment is not configured." }, { status: 503 });
  }

  let body: { orderId?: string; orderNumber?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const order =
    (body.orderId ? await getOrderById(body.orderId.trim()) : null) ||
    (body.orderNumber ? await getOrderByNumber(body.orderNumber.trim()) : null);

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.status !== "pending_payment") {
    return NextResponse.json({ error: "This order is no longer awaiting payment." }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    payment: buildCcavenueCheckoutForm(order, request),
  });
}
