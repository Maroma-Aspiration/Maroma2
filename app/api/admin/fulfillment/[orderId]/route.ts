import { NextResponse } from "next/server";
import {
  buildFulfillmentOrderDetail,
  setFulfillmentItemChecked,
} from "../../../../../lib/commerce-fulfillment";
import { getOrderById, updateOrderStatus } from "../../../../../lib/commerce-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { orderId: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const order = await getOrderById(params.orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const detail = await buildFulfillmentOrderDetail(order);
  return NextResponse.json({
    ok: true,
    ...detail,
    syncedAt: new Date().toISOString(),
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const order = await getOrderById(params.orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  let body: {
    key?: string;
    checked?: boolean;
    markFulfilled?: boolean;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.markFulfilled) {
    const updated = await updateOrderStatus(params.orderId, "fulfilled");
    if (!updated) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    const detail = await buildFulfillmentOrderDetail(updated);
    return NextResponse.json({ ok: true, ...detail, syncedAt: new Date().toISOString() });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) {
    return NextResponse.json({ error: "key is required." }, { status: 400 });
  }

  await setFulfillmentItemChecked(params.orderId, key, body.checked !== false);
  const refreshed = await getOrderById(params.orderId);
  if (!refreshed) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const detail = await buildFulfillmentOrderDetail(refreshed);
  return NextResponse.json({
    ok: true,
    ...detail,
    syncedAt: new Date().toISOString(),
  });
}
