import { parseInrPriceNumber } from "./format-price";
import type { ProductRecord } from "./product-types";

/** Resolves the customer-facing price, only accepting a genuine lower sale price. */
export function productPriceState(product: Pick<ProductRecord, "price" | "salePrice">): {
  regular: string;
  sale?: string;
  active: string;
  onSale: boolean;
} {
  const regularNumber = parseInrPriceNumber(product.price);
  const saleNumber = product.salePrice ? parseInrPriceNumber(product.salePrice) : null;
  const onSale = regularNumber !== null && saleNumber !== null && saleNumber > 0 && saleNumber < regularNumber;
  return { regular: product.price, sale: onSale ? product.salePrice : undefined, active: onSale ? product.salePrice! : product.price, onSale };
}
