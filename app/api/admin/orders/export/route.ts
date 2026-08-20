import { NextResponse } from "next/server";
import { listOrders } from "../../../../../lib/commerce-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromRaw = url.searchParams.get("from") || "";
  const toRaw = url.searchParams.get("to") || "";
  const idsRaw = url.searchParams.get("ids") || "";
  const selected = new Set(
    idsRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : null;
  const to = toRaw ? new Date(`${toRaw}T23:59:59.999`) : null;

  const orders = await listOrders({ limit: 2000 });
  const filtered = orders.filter((order) => {
    if (selected.size > 0 && !selected.has(order.id)) return false;
    const created = new Date(order.createdAt);
    if (from && !Number.isNaN(from.getTime()) && created < from) return false;
    if (to && !Number.isNaN(to.getTime()) && created > to) return false;
    return true;
  });

  const header = [
    "Order number",
    "Order ID",
    "Status",
    "Created",
    "Customer email",
    "Phone",
    "First name",
    "Last name",
    "Address",
    "City",
    "State",
    "Pincode",
    "Country",
    "SKU",
    "Product",
    "Quantity",
    "Unit price INR",
    "Line total INR",
    "Subtotal INR",
    "Discount INR",
    "Coupon",
    "Shipping INR",
    "Order total INR",
  ];

  const rows: string[][] = [header];
  for (const order of filtered) {
    if (order.lines.length === 0) {
      rows.push([
        order.orderNumber,
        order.id,
        order.status,
        order.createdAt,
        order.customerEmail,
        order.shipping.phone,
        order.shipping.firstName,
        order.shipping.lastName,
        order.shipping.address,
        order.shipping.city,
        order.shipping.state,
        order.shipping.pincode,
        order.shipping.country,
        "",
        "",
        "",
        "",
        "",
        String(order.subtotal),
        String(order.discountAmount),
        order.couponCode ?? "",
        String(order.shippingInr),
        String(order.total),
      ]);
      continue;
    }
    for (const line of order.lines) {
      rows.push([
        order.orderNumber,
        order.id,
        order.status,
        order.createdAt,
        order.customerEmail,
        order.shipping.phone,
        order.shipping.firstName,
        order.shipping.lastName,
        order.shipping.address,
        order.shipping.city,
        order.shipping.state,
        order.shipping.pincode,
        order.shipping.country,
        line.sku,
        line.name,
        String(line.quantity),
        String(line.price),
        String(Math.round(line.price * line.quantity * 100) / 100),
        String(order.subtotal),
        String(order.discountAmount),
        order.couponCode ?? "",
        String(order.shippingInr),
        String(order.total),
      ]);
    }
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const filename = `maroma-orders-${fromRaw || "all"}-${toRaw || "all"}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
