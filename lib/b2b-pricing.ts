import type { B2bAssortmentItem, B2bCompany, B2bQuoteLine } from "./b2b-types";
import { parseInrPriceNumber } from "./format-price";
import type { ProductRecord } from "./product-types";

export const WHITE_LABEL_DISCOUNT_RATE = 0.35;
export const WHITE_LABEL_MIN_SPEND_INR = 15000;

export function isWhiteLabelCompany(company: Pick<B2bCompany, "program">): boolean {
  return company.program === "white_label";
}

export function whiteLabelDiscountRate(company: Pick<B2bCompany, "program" | "whiteLabelDiscountPercent">): number {
  if (!isWhiteLabelCompany(company)) return 0;
  const pct = company.whiteLabelDiscountPercent;
  const rate = typeof pct === "number" && Number.isFinite(pct) ? pct / 100 : WHITE_LABEL_DISCOUNT_RATE;
  return Math.min(0.9, Math.max(0, rate));
}

export function whiteLabelMinSpendInr(company: Pick<B2bCompany, "program" | "whiteLabelMinSpendInr">): number {
  if (!isWhiteLabelCompany(company)) return 0;
  const min = company.whiteLabelMinSpendInr;
  return typeof min === "number" && Number.isFinite(min) && min > 0 ? min : WHITE_LABEL_MIN_SPEND_INR;
}

export function whiteLabelUnitPrice(retailInr: number, discountRate: number): number {
  return Math.round(retailInr * (1 - discountRate) * 100) / 100;
}

export function resolveCompanyAssortment(
  company: B2bCompany,
  products: ProductRecord[]
): B2bAssortmentItem[] {
  if (isWhiteLabelCompany(company)) {
    const rate = whiteLabelDiscountRate(company);
    return products
      .map((product) => {
        const retail = parseInrPriceNumber(product.price);
        if (retail == null || retail <= 0) return null;
        return {
          productId: product.id,
          priceInr: whiteLabelUnitPrice(retail, rate),
          moq: 1,
        } satisfies B2bAssortmentItem;
      })
      .filter((row): row is B2bAssortmentItem => Boolean(row));
  }
  return company.assortment;
}

export function buildB2bQuoteLines(
  company: B2bCompany,
  products: ProductRecord[],
  requested: Array<{ productId?: string; quantity?: number }>
): { lines: B2bQuoteLine[]; error?: string } {
  const assortmentById = new Map(
    resolveCompanyAssortment(company, products).map((item) => [item.productId, item])
  );
  const productById = new Map(products.map((p) => [p.id, p]));
  const lines: B2bQuoteLine[] = [];
  for (const row of requested) {
    const productId = typeof row.productId === "string" ? row.productId.trim() : "";
    const qty = Math.floor(Number(row.quantity) || 0);
    const item = assortmentById.get(productId);
    const product = productById.get(productId);
    if (!item || !product || qty < 1) continue;
    if (qty < item.moq) {
      return { lines: [], error: `${product.name} requires a minimum of ${item.moq}.` };
    }
    const lineTotalInr = Math.round(item.priceInr * qty * 100) / 100;
    lines.push({
      productId,
      name: product.name,
      sku: product.sku,
      quantity: qty,
      unitPriceInr: item.priceInr,
      lineTotalInr,
    });
  }
  return { lines };
}
