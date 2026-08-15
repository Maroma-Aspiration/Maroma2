import { NextResponse } from "next/server";
import { getOrderById } from "../../../../../lib/commerce-orders";
import { assignShiprocketAwb, createShiprocketOrder, generateShiprocketLabel, getShiprocketState, refreshShiprocketTracking, scheduleShiprocketPickup, shiprocketSetup } from "../../../../../lib/shiprocket";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
type Context = { params: { orderId: string } };
export async function GET(_request: Request, { params }: Context) { return NextResponse.json({ ok: true, setup: shiprocketSetup(), shipment: await getShiprocketState(params.orderId) }); }
export async function POST(request: Request, { params }: Context) {
  try {
    const order = await getOrderById(params.orderId); if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const body = await request.json() as { action?: string; courierId?: number; weight?: number; length?: number; breadth?: number; height?: number };
    let shipment;
    if (body.action === "create") shipment = await createShiprocketOrder(order, body);
    else if (body.action === "awb") shipment = await assignShiprocketAwb(order.id, body.courierId);
    else if (body.action === "pickup") shipment = await scheduleShiprocketPickup(order.id);
    else if (body.action === "label") shipment = await generateShiprocketLabel(order.id);
    else if (body.action === "track") shipment = await refreshShiprocketTracking(order.id);
    else return NextResponse.json({ error: "Invalid Shiprocket action." }, { status: 400 });
    return NextResponse.json({ ok: true, setup: shiprocketSetup(), shipment });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Shiprocket request failed." }, { status: 502 }); }
}
