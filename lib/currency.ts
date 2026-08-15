import { parseInrPriceNumber } from "./format-price";

export const SUPPORTED_CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// Display-only reference rates. Checkout always recalculates and charges server-side.
export const INR_PER_CURRENCY: Record<SupportedCurrency, number> = {
  INR: 1,
  USD: 92,
  GBP: 123,
  EUR: 107,
  AED: 25.1,
  SGD: 71.5,
  AUD: 65.5,
  CAD: 67,
};

const LOCALES: Record<SupportedCurrency, string> = {
  INR: "en-IN", USD: "en-US", GBP: "en-GB", EUR: "en-IE",
  AED: "en-AE", SGD: "en-SG", AUD: "en-AU", CAD: "en-CA",
};

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(value as SupportedCurrency);
}

export function convertFromInr(amountInr: number, currency: SupportedCurrency): number {
  return amountInr / INR_PER_CURRENCY[currency];
}

export function formatDisplayPrice(amountInr: number, currency: SupportedCurrency): string {
  const converted = convertFromInr(amountInr, currency);
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "INR" ? 2 : 2,
    maximumFractionDigits: 2,
  }).format(converted);
}

export function formatCatalogDisplayPrice(raw: string, currency: SupportedCurrency): string | null {
  const amount = parseInrPriceNumber(raw);
  return amount === null ? null : formatDisplayPrice(amount, currency);
}
