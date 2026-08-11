import { NextResponse } from "next/server";
import { invalidateCatalogCache } from "../../../../../lib/commerce-product";
import { setProductStock } from "../../../../../lib/commerce-stock";
import { upsertCatalogEdit } from "../../../../../lib/product-catalog-edits";
import {
  getAdminProduct,
  validateProductCatalogPatch,
  type ProductCatalogPatch,
} from "../../../../../lib/product-catalog-admin";
import { readProducts } from "../../../../../lib/product-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { productId: string } };

export async function GET(_request: Request, context: RouteContext) {
  const productId = context.params.productId?.trim();
  if (!productId) {
    return NextResponse.json({ error: "Product id is required." }, { status: 400 });
  }

  const product = await getAdminProduct(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, product });
}

export async function PATCH(request: Request, context: RouteContext) {
  const productId = context.params.productId?.trim();
  if (!productId) {
    return NextResponse.json({ error: "Product id is required." }, { status: 400 });
  }

  const baseProducts = await readProducts();
  if (!baseProducts.some((product) => product.id === productId)) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  let body: ProductCatalogPatch = {};
  try {
    body = (await request.json()) as ProductCatalogPatch;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateProductCatalogPatch(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const editPatch: Omit<import("../../../../../lib/product-catalog-edits").ProductCatalogEdit, "updatedAt"> =
    {};
  if (body.name !== undefined) editPatch.name = body.name.trim();
  if (body.sku !== undefined) editPatch.sku = body.sku.trim();
  if (body.price !== undefined) editPatch.price = body.price.trim();
  if (body.shortDescription !== undefined) editPatch.shortDescription = body.shortDescription;
  if (body.description !== undefined) editPatch.description = body.description;
  if (body.categories !== undefined) editPatch.categories = body.categories;
  if (body.tags !== undefined) editPatch.tags = body.tags;
  if (body.brand !== undefined) editPatch.brand = body.brand.trim();
  if (body.published !== undefined) editPatch.published = body.published;

  if (Object.keys(editPatch).length > 0) {
    await upsertCatalogEdit(productId, editPatch);
  }

  if (body.stock !== undefined) {
    await setProductStock(productId, body.stock);
  }

  invalidateCatalogCache();

  const product = await getAdminProduct(productId);
  return NextResponse.json({ ok: true, product });
}
