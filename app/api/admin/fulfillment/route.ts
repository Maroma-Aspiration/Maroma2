import { NextResponse } from "next/server";
import {
  buildFulfillmentOrderSummary,
  getOrderFulfillmentState,
} from "../../../../lib/commerce-fulfillment";
import { listOrders } from "../../../../lib/commerce-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const includeFulfilled = url.searchParams.get("includeFulfilled") === "1";

  const orders = await listOrders({ limit: 200 });
  const filtered = orders.filter((order) => {
    if (!includeFulfilled && order.status === "fulfilled") return false;
    if (!includeFulfilled && order.status === "cancelled") return false;
    if (statusFilter && order.status !== statusFilter) return false;
    return true;
  });

  const summaries = await Promise.all(
    filtered.map(async (order) => {
      const fulfillment = await getOrderFulfillmentState(order.id);
      return buildFulfillmentOrderSummary(order, fulfillment);
    })
  );

  return NextResponse.json({
    ok: true,
    orders: summaries,
    syncedAt: new Date().toISOString(),
  });
}
