import { NextResponse } from "next/server";
import { readLiveStorefrontCatalog } from "../../../lib/product-catalog-admin";
import { filterProducts } from "../../../lib/product-db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const category = url.searchParams.get("category") ?? "";
    const limitValue = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitValue) ? Math.max(0, limitValue) : undefined;
    const onlyWithImages = url.searchParams.get("onlyWithImages") === "1";

    const { products: merged } = await readLiveStorefrontCatalog();
    const filtered = filterProducts(merged, { q, category, limit, onlyWithImages });

    return NextResponse.json(
      {
        total: merged.length,
        count: filtered.length,
        products: filtered
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load product database." },
      { status: 500 }
    );
  }
}
