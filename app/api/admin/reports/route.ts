import { NextResponse } from "next/server";
import { listOrders } from "../../../../lib/commerce-orders";
import { listAdminProducts } from "../../../../lib/product-catalog-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") || 0);
  const to = new Date(url.searchParams.get("to") || Date.now());
  to.setHours(23, 59, 59, 999);
  const [orders, catalog] = await Promise.all([listOrders(), listAdminProducts({ page: 1, limit: 100 })]);
  const allProducts = [...catalog.products];
  for (let page = 2; page <= Math.ceil(catalog.total / 100); page++) {
    const next = await listAdminProducts({ page, limit: 100 });
    allProducts.push(...next.products);
  }
  const sales = orders.filter((order) => ["paid", "fulfilled"].includes(order.status))
    .filter((order) => { const date = new Date(order.payment?.paidAt || order.createdAt); return date >= from && date <= to; });
  const daily = new Map<string, { revenue: number; orders: number }>();
  const products = new Map<string, { name: string; units: number; revenue: number }>();
  for (const order of sales) {
    const key = new Date(order.payment?.paidAt || order.createdAt).toISOString().slice(0, 10);
    const day = daily.get(key) || { revenue: 0, orders: 0 }; day.revenue += order.total; day.orders += 1; daily.set(key, day);
    for (const line of order.lines) {
      const item = products.get(line.productId) || { name: line.name, units: 0, revenue: 0 };
      item.units += line.quantity; item.revenue += line.price * line.quantity; products.set(line.productId, item);
    }
  }
  const stock = allProducts.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, category: p.primaryCategory }));
  return NextResponse.json({
    ok: true, from: from.toISOString(), to: to.toISOString(),
    summary: { revenue: sales.reduce((sum, o) => sum + o.total, 0), orders: sales.length, units: sales.reduce((sum, o) => sum + o.lines.reduce((n, l) => n + l.quantity, 0), 0), products: stock.length, availableUnits: stock.reduce((sum, p) => sum + p.stock, 0), lowStock: stock.filter((p) => p.stock > 0 && p.stock <= 10).length, outOfStock: stock.filter((p) => p.stock <= 0).length },
    daily: Array.from(daily, ([date, value]) => ({ date, ...value })).sort((a, b) => a.date.localeCompare(b.date)),
    lowStock: stock.filter((p) => p.stock <= 10).sort((a, b) => a.stock - b.stock).slice(0, 30),
    topProducts: Array.from(products.values()).sort((a, b) => b.units - a.units).slice(0, 8),
  });
}
