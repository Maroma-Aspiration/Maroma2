"use client";

import { useState } from "react";

export function CheckoutPayAgain({ orderNumber }: { orderNumber: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const payAgain = () => {
    if (busy || !orderNumber) return;
    setBusy(true);
    setError("");
    const host = window.location.hostname;
    const origin =
      host === "localhost" || host === "127.0.0.1"
        ? window.location.origin
        : "https://maromashopping.com";
    window.location.assign(
      `${origin}/api/checkout/ccavenue/redirect?order=${encodeURIComponent(orderNumber)}`
    );
  };

  return (
    <div>
      <button type="button" className="maroma-btn maroma-btn-primary" disabled={busy} onClick={payAgain}>
        {busy ? "Opening CCAvenue…" : "Pay again with CCAvenue"}
      </button>
      {error ? (
        <p className="maroma-commerce-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
