import { NextResponse } from "next/server";
import {
  listAdminProducts,
  type AdminProductFilter,
  type AdminProductListQuery,
} from "../../../../../lib/product-catalog-admin";
import { formatInrPrice } from "../../../../../lib/format-price";

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

const INCI_LABELS = {
  ok: "Has INCI",
  missing: "Missing INCI",
  not_applicable: "Not applicable",
} as const;

function parseStatuses(url: URL): AdminProductFilter[] {
  const multi = url.searchParams.getAll("status").flatMap((value) => value.split(","));
  const legacy = (url.searchParams.get("statuses") ?? "").split(",");
  const values = [...multi, ...legacy]
    .map((value) => value.trim())
    .filter((value): value is AdminProductFilter => ALLOWED_FILTERS.has(value as AdminProductFilter));
  return Array.from(new Set(values));
}

function escapeCsvCell(value: string): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const statuses = parseStatuses(url);
  const sortBy = (url.searchParams.get("sortBy")?.trim() || "product") as AdminProductListQuery["sortBy"];
  const sortDirection = (url.searchParams.get("sortDirection")?.trim() || "asc") as AdminProductListQuery["sortDirection"];

  const result = await listAdminProducts({
    q: q || undefined,
    category: category || undefined,
    statuses,
    sortBy,
    sortDirection,
    all: true,
    limit: 5000,
  });

  const header = [
    "Product ID",
    "Name",
    "SKU",
    "Live status",
    "Has image",
    "INCI status",
    "Stock",
    "Price (INR)",
    "Primary category",
    "All categories",
    "Admin URL",
  ];

  const origin = url.origin;
  const rows = [
    header,
    ...result.products.map((product) => [
      product.id,
      product.name,
      product.sku,
      product.liveStatus,
      product.hasImage ? "Yes" : "No",
      INCI_LABELS[product.inciStatus],
      String(product.stock),
      formatInrPrice(product.price) ?? product.price,
      product.primaryCategory,
      product.categories.join(" | "),
      `${origin}/admin/products/${product.id}`,
    ]),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const filterSlug = statuses.length ? statuses.join("-") : "all";
  const filename = `maroma-products-${filterSlug}-${stamp}.csv`;

  // UTF-8 BOM so Excel on Windows recognises Unicode correctly.
  const csv = `\uFEFF${buildCsv(rows)}\r\n`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
