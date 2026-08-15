import { NextResponse } from "next/server";
import {
  buildFulfillmentOrderDetail,
  setFulfillmentItemChecked,
  setFulfillmentTaskOverride,
} from "../../../../../lib/commerce-fulfillment";
import { getOrderById, updateOrderStatus } from "../../../../../lib/commerce-orders";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../lib/auth-session";

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
    action?: "edit_task" | "delete_task";
    label?: string;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action === "edit_task" || body.action === "delete_task") {
    const secret = getSessionSecret();
    const token = cookies().get(SESSION_COOKIE)?.value;
    const session = secret && token ? await verifySessionPayload(token, secret) : null;
    if (session?.role !== "admin") return NextResponse.json({ error: "Only administrators can edit production tasks." }, { status: 403 });
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key) return NextResponse.json({ error: "key is required." }, { status: 400 });
    const currentDetail = await buildFulfillmentOrderDetail(order);
    if (!currentDetail.checklist.some((item) => item.key === key)) {
      return NextResponse.json({ error: "Production task not found." }, { status: 404 });
    }
    if (body.action === "edit_task" && !body.label?.trim()) return NextResponse.json({ error: "Task name is required." }, { status: 400 });
    await setFulfillmentTaskOverride(params.orderId, key, body.action === "delete_task" ? { deleted: true } : { label: body.label!.trim() });
    const refreshed = await getOrderById(params.orderId);
    const detail = await buildFulfillmentOrderDetail(refreshed!);
    return NextResponse.json({ ok: true, ...detail, syncedAt: new Date().toISOString() });
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
