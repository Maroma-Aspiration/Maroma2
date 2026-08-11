import { NextResponse } from "next/server";
import { getAvailableStock, readStockStore, setProductStock } from "../../../../lib/commerce-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim() ?? "";

  if (productId) {
    const quantity = await getAvailableStock(productId);
    return NextResponse.json({ ok: true, productId, quantity });
  }

  const store = await readStockStore();
  return NextResponse.json({ ok: true, stock: store.stock, updatedAt: store.updatedAt });
}

export async function PATCH(request: Request) {
  let body: { productId?: string; quantity?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const quantity = typeof body.quantity === "number" ? body.quantity : NaN;
  if (!productId || !Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ error: "productId and quantity are required." }, { status: 400 });
  }

  const store = await setProductStock(productId, quantity);
  return NextResponse.json({
    ok: true,
    productId,
    quantity: store.stock[productId],
    updatedAt: store.updatedAt,
  });
}
