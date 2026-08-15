"use client";

import { useCurrency } from "../../context/CurrencyContext";

export function CurrencyPrice({ raw, fallback = "Price on request" }: { raw: string; fallback?: string }) {
  const { formatCatalogPrice, isEstimated } = useCurrency();
  const label = formatCatalogPrice(raw);
  return <>{label ? `${isEstimated ? "≈ " : ""}${label}` : fallback}</>;
}
