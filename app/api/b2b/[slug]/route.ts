import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { getB2bCompanyBySlug } from "../../../../lib/b2b-store";
import { decodeBasicHtmlEntities } from "../../../../lib/decode-html-entities";
import { getDisplayImageUrl } from "../../../../lib/product-image";
import { readMergedCatalog } from "../../../../lib/product-catalog-admin";
import { parseInrPriceNumber } from "../../../../lib/format-price";
import type { ProductRecord } from "../../../../lib/product-types";

type Ctx = { params: { slug: string } };

export async function GET(_request: Request, ctx: Ctx) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session) {
    return NextResponse.json({ error: "Sign in required.", code: "auth_required" }, { status: 401 });
  }

  const company = await getB2bCompanyBySlug(ctx.params.slug);
  if (!company || company.status === "pending") {
    return NextResponse.json({ error: "B2B page not found." }, { status: 404 });
  }
  if (company.status === "paused" && session.role !== "admin") {
    return NextResponse.json({ error: "This B2B page is temporarily paused." }, { status: 403 });
  }

  const isOwner = session.email.trim().toLowerCase() === company.userEmail;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "This private page is not linked to your account.", code: "forbidden" },
      { status: 403 }
    );
  }

  const { products } = await readMergedCatalog();
  const byId = new Map<string, ProductRecord>(products.map((p) => [p.id, p]));
  const assortment = company.assortment
    .map((item) => {
      const product = byId.get(item.productId);
      if (!product) return null;
      const retail = parseInrPriceNumber(product.price);
      return {
        productId: product.id,
        sku: product.sku,
        name: decodeBasicHtmlEntities(product.name),
        imageUrl: getDisplayImageUrl(product) || product.imageUrl || "",
        priceInr: item.priceInr,
        moq: item.moq,
        retailPriceInr: retail,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return NextResponse.json({
    company: {
      id: company.id,
      slug: company.slug,
      name: company.name,
      commerceMode: company.commerceMode,
      status: company.status,
      userEmail: company.userEmail,
      deliveryAddresses: company.deliveryAddresses,
    },
    assortment,
    viewer: { email: session.email, role: session.role, isAdmin },
    payments: {
      payNowAvailable: Boolean(
        process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()
      ),
    },
  });
}
