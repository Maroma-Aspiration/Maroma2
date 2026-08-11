import { NextResponse } from "next/server";
import { CartError } from "../../../../lib/commerce-cart";
import { markOrderPaid } from "../../../../lib/commerce-checkout";
import { getOrderById, listOrders, updateOrderStatus } from "../../../../lib/commerce-orders";
import { orderHasGiftSets } from "../../../../lib/gift-set-production";
import type { OrderStatus } from "../../../../lib/commerce-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const orders = await listOrders({ limit: 200 });
  return NextResponse.json({
    ok: true,
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerEmail: order.customerEmail,
      total: order.total,
      createdAt: order.createdAt,
      lineCount: order.lines.length,
      hasGiftSets: orderHasGiftSets(order),
      shipping: {
        firstName: order.shipping.firstName,
        lastName: order.shipping.lastName,
        city: order.shipping.city,
        pincode: order.shipping.pincode,
      },
    })),
  });
}

export async function PATCH(request: Request) {
  let body: { orderId?: string; status?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!orderId || !status) {
    return NextResponse.json({ error: "orderId and status are required." }, { status: 400 });
  }

  const allowed: OrderStatus[] = ["pending_payment", "paid", "fulfilled", "cancelled"];
  if (!allowed.includes(status as OrderStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    if (status === "paid") {
      const order = await markOrderPaid(orderId, undefined, request);
      return NextResponse.json({ ok: true, order });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const updated = await updateOrderStatus(orderId, status as OrderStatus);
    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    if (error instanceof CartError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("admin orders PATCH failed", error);
    return NextResponse.json({ error: "Failed to update order." }, { status: 500 });
  }
}
