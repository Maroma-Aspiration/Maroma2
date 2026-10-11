import { NextResponse } from "next/server";
import { readMergedCatalog } from "../../../../lib/product-catalog-admin";
import { acknowledgeSizeAudit, sizeAuditFingerprint } from "../../../../lib/product-size-audit-acknowledgements";
import { auditCatalogProductSizes } from "../../../../lib/product-size-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let productId = "";
  try {
    const body = await request.json() as { productId?: unknown };
    productId = typeof body.productId === "string" ? body.productId.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!productId) return NextResponse.json({ error: "Product id is required." }, { status: 400 });

  const { products } = await readMergedCatalog();
  const product = products.find((item) => item.id === productId);
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const audit = auditCatalogProductSizes(products).get(productId);
  if (!audit || audit.status === "clear") {
    return NextResponse.json({ error: "This listing no longer needs a size check." }, { status: 400 });
  }

  await acknowledgeSizeAudit(productId, sizeAuditFingerprint(productId, audit));
  return NextResponse.json({ ok: true });
}
