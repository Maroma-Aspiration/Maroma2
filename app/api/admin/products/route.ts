import { NextResponse } from "next/server";
import {
  getAdminProduct,
  listAdminProducts,
  type AdminProductFilter,
  type AdminProductListQuery,
} from "../../../../lib/product-catalog-admin";
import { addCreatedProduct } from "../../../../lib/admin-created-products";
import { upsertCatalogEdit } from "../../../../lib/product-catalog-edits";
import { setProductStock } from "../../../../lib/commerce-stock";
import { invalidateCatalogCache } from "../../../../lib/commerce-product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FILTERS = new Set<AdminProductFilter>([
  "live",
  "not_live",
  "draft",
  "out_of_stock",
  "no_image",
  "low_stock",
  "missing_inci",
]);

function parseStatuses(url: URL): AdminProductFilter[] {
  const multi = url.searchParams.getAll("status").flatMap((value) => value.split(","));
  const values = multi
    .map((value) => value.trim())
    .filter((value): value is AdminProductFilter => ALLOWED_FILTERS.has(value as AdminProductFilter));
  return Array.from(new Set(values));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const statuses = parseStatuses(url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "25");
  const sortBy = (url.searchParams.get("sortBy")?.trim() || "product") as AdminProductListQuery["sortBy"];
  const sortDirection = (url.searchParams.get("sortDirection")?.trim() || "asc") as AdminProductListQuery["sortDirection"];

  const result = await listAdminProducts({
    q: q || undefined,
    category: category || undefined,
    statuses,
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 25,
    sortBy,
    sortDirection,
  });

  return NextResponse.json({ ok: true, ...result, statuses });
}

export async function POST(request: Request) {
  let body: { name?: string; sku?: string; duplicateFrom?: string } = {};
  try { body = await request.json(); } catch {}
  const sourceId = body.duplicateFrom?.trim();
  if (sourceId) {
    const source = await getAdminProduct(sourceId);
    if (!source) return NextResponse.json({ error: "Source product not found." }, { status: 404 });
    const id = `admin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await addCreatedProduct({
      id,
      sku: `${source.sku}-COPY`,
      name: `Copy of ${source.name}`,
      description: source.description,
      shortDescription: source.shortDescription,
      price: source.price,
      salePrice: source.salePrice,
      categories: source.categories,
      tags: source.tags,
      brand: source.brand,
      images: source.images,
      imageUrl: source.imageUrl ?? "",
      attributes: source.attributes,
    });
    await Promise.all([
      upsertCatalogEdit(id, { published: false }),
      setProductStock(id, 0),
    ]);
    invalidateCatalogCache();
    const product = await getAdminProduct(id);
    return NextResponse.json({ ok: true, product }, { status: 201 });
  }
  const name = body.name?.trim() || "Untitled product";
  const sku = body.sku?.trim() || `NEW-${Date.now().toString(36).toUpperCase()}`;
  const id = `admin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await addCreatedProduct({
    id, sku, name, description: "", shortDescription: "", price: "0",
    categories: ["Uncategorised"], tags: [], brand: "Maroma", images: [], imageUrl: "", attributes: {},
  });
  await Promise.all([
    upsertCatalogEdit(id, { published: false }),
    setProductStock(id, 0),
  ]);
  invalidateCatalogCache();
  const product = await getAdminProduct(id);
  return NextResponse.json({ ok: true, product }, { status: 201 });
}
