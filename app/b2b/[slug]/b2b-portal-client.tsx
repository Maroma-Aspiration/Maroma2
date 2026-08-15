"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInrPrice } from "../../../lib/format-price";

type AssortmentRow = {
  productId: string;
  sku: string;
  name: string;
  imageUrl: string;
  priceInr: number;
  moq: number;
  retailPriceInr: number | null;
};

type PortalPayload = {
  company: {
    id: string;
    slug: string;
    name: string;
    commerceMode: "quote" | "checkout";
    status: string;
    userEmail: string;
  };
  assortment: AssortmentRow[];
  viewer: { email: string; role: string; isAdmin: boolean };
  error?: string;
};

export default function B2bPortalClient({ slug }: { slug: string }) {
  const [data, setData] = useState<PortalPayload | null>(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/b2b/${encodeURIComponent(slug)}`, { cache: "no-store" });
    const payload = (await res.json()) as PortalPayload;
    if (!res.ok) {
      setError(payload.error || "Could not load this B2B page.");
      return;
    }
    setData(payload);
    const initial: Record<string, number> = {};
    for (const row of payload.assortment) {
      initial[row.productId] = row.moq;
    }
    setQty(initial);
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const lines = useMemo(() => {
    if (!data) return [];
    return data.assortment
      .map((row) => {
        const quantity = Math.max(0, Math.floor(qty[row.productId] || 0));
        if (quantity < 1) return null;
        return {
          ...row,
          quantity,
          lineTotal: Math.round(row.priceInr * quantity * 100) / 100,
        };
      })
      .filter(Boolean) as Array<AssortmentRow & { quantity: number; lineTotal: number }>;
  }, [data, qty]);

  const subtotal = useMemo(
    () => Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100,
    [lines]
  );

  const submitQuote = async () => {
    if (!data) return;
    setBusy(true);
    setStatus("");
    const res = await fetch(`/api/b2b/${encodeURIComponent(slug)}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      }),
    });
    const payload = (await res.json()) as { error?: string; subtotalInr?: number };
    if (!res.ok) {
      setStatus(payload.error || "Could not submit quote.");
      setBusy(false);
      return;
    }
    setStatus(`Quote request sent (₹${(payload.subtotalInr ?? subtotal).toFixed(2)}). Maroma will follow up.`);
    setBusy(false);
  };

  if (error) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1 className="login-title">B2B</h1>
          <p className="login-reason">{error}</p>
          <Link href="/login" className="button primary button-sage">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="catalog-admin-page">
        <p className="catalog-admin-empty">Loading private catalogue…</p>
      </main>
    );
  }

  const isQuote = data.company.commerceMode === "quote";

  return (
    <main className="catalog-admin-page">
      <div className="catalog-admin-shell catalog-admin-shell--edit">
        <header className="catalog-admin-header">
          <div>
            <p className="catalog-admin-back" style={{ opacity: 0.7 }}>
              Maroma B2B · Private
            </p>
            <h1>{data.company.name}</h1>
            <p className="catalog-admin-lede">
              Restricted assortment with your negotiated rates.
              {isQuote
                ? " Submit a quote request — Maroma will confirm availability and invoicing."
                : " Checkout mode is enabled for negotiated rates."}
              {data.viewer.isAdmin ? " (Admin preview)" : null}
            </p>
          </div>
          <div className="catalog-admin-header-actions">
            <Link href="/account" className="button secondary">
              Account
            </Link>
          </div>
        </header>

        {status ? <p className="catalog-admin-status catalog-admin-status--ok">{status}</p> : null}

        {data.assortment.length === 0 ? (
          <section className="catalog-admin-card">
            <p className="catalog-admin-card-copy">No products have been assigned to this page yet.</p>
          </section>
        ) : (
          <section className="catalog-admin-card">
            <div style={{ display: "grid", gap: 14 }}>
              {data.assortment.map((row) => (
                <article
                  key={row.productId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "72px 1fr 120px",
                    gap: 14,
                    alignItems: "center",
                    borderTop: "1px solid rgba(0,0,0,0.08)",
                    paddingTop: 12,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      overflow: "hidden",
                      background: "#e8f0ec",
                    }}
                  >
                    {row.imageUrl ? (
                      <img
                        src={row.imageUrl}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : null}
                  </div>
                  <div>
                    <strong>{row.name}</strong>
                    <div className="catalog-admin-card-copy">
                      {row.sku} · MOQ {row.moq}
                      <br />
                      Your price: {formatInrPrice(String(row.priceInr)) ?? `₹${row.priceInr}`}
                    </div>
                  </div>
                  <label className="catalog-admin-field">
                    <span>Qty</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={qty[row.productId] ?? 0}
                      onChange={(e) =>
                        setQty((current) => ({
                          ...current,
                          [row.productId]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        }))
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="catalog-admin-card">
          <h2>{isQuote ? "Request quote" : "Order"}</h2>
          <p className="catalog-admin-card-copy">
            {lines.length} line{lines.length === 1 ? "" : "s"} · Subtotal{" "}
            {formatInrPrice(String(subtotal)) ?? `₹${subtotal}`}
          </p>
          <label className="catalog-admin-field">
            <span>Message (optional)</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          {isQuote ? (
            <button
              type="button"
              className="button primary button-sage"
              disabled={busy || lines.length === 0}
              onClick={() => void submitQuote()}
            >
              {busy ? "Sending…" : "Submit quote request"}
            </button>
          ) : (
            <p className="catalog-admin-card-copy">
              Checkout with negotiated rates is configured for this page. Live wholesale checkout will
              connect once payment capture is enabled — for now, submit quantities via quote or contact
              Maroma to place the order.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
