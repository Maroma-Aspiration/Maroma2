"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../../context/CartContext";
import type { ProductRecord } from "../../lib/product-types";

type Props = {
  product: ProductRecord;
};

export function ProductCardBuyNow({ product }: Props) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [busy, setBusy] = useState(false);

  const handleBuyNow = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await addToCart(product, undefined, 1);
    if (!ok) {
      setBusy(false);
      return;
    }
    router.push("/checkout");
  };

  return (
    <button
      type="button"
      className={`product-card-cta product-card-buy-now${busy ? " is-busy" : ""}`}
      onClick={handleBuyNow}
      disabled={busy}
    >
      {busy ? "Opening checkout…" : "Buy Now"}
    </button>
  );
}
