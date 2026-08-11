import { NextResponse } from "next/server";
import { markOrderPaid } from "../../../../lib/commerce-checkout";
import { getOrderById } from "../../../../lib/commerce-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook endpoint — wire when payment keys are configured.
 * Expects { orderId, razorpayOrderId?, razorpayPaymentId? } in JSON body for now.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Razorpay webhook not configured. Set RAZORPAY_WEBHOOK_SECRET." },
      { status: 503 }
    );
  }

  let body: { orderId?: string; razorpayOrderId?: string; razorpayPaymentId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const updated = await markOrderPaid(
    orderId,
    {
      provider: "razorpay",
      orderId: body.razorpayOrderId,
      paymentId: body.razorpayPaymentId,
      paidAt: new Date().toISOString(),
    },
    request
  );

  return NextResponse.json({ ok: true, order: { id: updated.id, status: updated.status } });
}
