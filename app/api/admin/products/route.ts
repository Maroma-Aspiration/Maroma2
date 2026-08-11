import { NextResponse } from "next/server";
import {
  getAdminProduct,
  listAdminProducts,
  type AdminProductListQuery,
} from "../../../../lib/product-catalog-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const status = (url.searchParams.get("status")?.trim() ?? "all") as AdminProductListQuery["status"];
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "25");

  const result = await listAdminProducts({
    q: q || undefined,
    category: category || undefined,
    status: status || "all",
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 25,
  });

  return NextResponse.json({ ok: true, ...result });
}
