"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProductAdminToolbar({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const deleteProduct = async () => {
    if (!window.confirm(`Delete “${productName}”? This removes it from the storefront and product listings.`)) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete product.");
      router.push("/admin/products");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete product.");
      setDeleting(false);
    }
  };

  return (
    <aside className="product-pdp-admin-toolbar" aria-label="Admin product actions">
      <span>Admin controls</span>
      <Link href={`/admin/products/${encodeURIComponent(productId)}`}>Edit product details</Link>
      <button type="button" onClick={() => void deleteProduct()} disabled={deleting}>
        {deleting ? "Deleting…" : "Delete product"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </aside>
  );
}
