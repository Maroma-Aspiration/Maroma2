import { NextResponse } from "next/server";
import { getOrderByNumber, listOrdersForEmail } from "../../../lib/commerce-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; orderNumber?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";

  if (!email || !orderNumber) {
    return NextResponse.json({ error: "Email and order number are required." }, { status: 400 });
  }

  const order = await getOrderByNumber(orderNumber);
  if (!order || order.customerEmail.toLowerCase() !== email) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      lines: order.lines,
      shipping: {
        firstName: order.shipping.firstName,
        lastName: order.shipping.lastName,
        city: order.shipping.city,
      },
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const orders = await listOrdersForEmail(email, 20);
  return NextResponse.json({
    ok: true,
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      lineCount: order.lines.length,
    })),
  });
}
