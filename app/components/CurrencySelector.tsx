"use client";

import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "../../lib/currency";
import { useCurrency } from "../../context/CurrencyContext";

export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <label className={`currency-selector${compact ? " currency-selector--compact" : ""}`}>
      <span className="sr-only">Display currency</span>
      <select
        aria-label="Display currency"
        value={currency}
        onChange={(event) => setCurrency(event.target.value as SupportedCurrency)}
      >
        {SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
      </select>
    </label>
  );
}
