"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  formatCatalogDisplayPrice,
  formatDisplayPrice,
  isSupportedCurrency,
  type SupportedCurrency,
} from "../lib/currency";

const STORAGE_KEY = "maroma-display-currency";

type CurrencyContextValue = {
  currency: SupportedCurrency;
  setCurrency: (currency: SupportedCurrency) => void;
  formatMoney: (amountInr: number) => string;
  formatCatalogPrice: (raw: string) => string | null;
  isEstimated: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>("INR");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedCurrency(stored)) setCurrencyState(stored);
  }, []);

  const setCurrency = (next: SupportedCurrency) => {
    setCurrencyState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<CurrencyContextValue>(() => ({
    currency,
    setCurrency,
    formatMoney: (amountInr) => formatDisplayPrice(amountInr, currency),
    formatCatalogPrice: (raw) => formatCatalogDisplayPrice(raw, currency),
    isEstimated: currency !== "INR",
  }), [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error("useCurrency must be used inside CurrencyProvider");
  return value;
}
