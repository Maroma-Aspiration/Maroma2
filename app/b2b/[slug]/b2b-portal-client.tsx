"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInrPrice } from "../../../lib/format-price";
import { decodeBasicHtmlEntities } from "../../../lib/decode-html-entities";
import type { B2bDeliveryAddress } from "../../../lib/b2b-types";
import {
  filterB2bCatalog,
  listB2bCatalogBrands,
  listB2bCatalogCategories,
  type B2bCatalogQuickFilter,
  type B2bCatalogRow,
  type B2bCatalogSort,
} from "../../../lib/b2b-catalog-filter";
import "./b2b-portal.css";

type AssortmentRow = B2bCatalogRow;

type PortalPayload = {
  company: {
    id: string;
    slug: string;
    name: string;
    commerceMode: "quote" | "checkout";
    status: string;
    program?: "custom" | "white_label" | "branded";
    whiteLabelDiscountPercent?: number;
    whiteLabelMinSpendInr?: number;
    userEmail: string;
    deliveryAddresses: B2bDeliveryAddress[];
  };
  assortment: AssortmentRow[];
  viewer: { email: string; role: string; isAdmin: boolean };
  payments?: { payNowAvailable?: boolean };
  error?: string;
};

type RazorpayCheckoutSession = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { email: string; contact: string; name: string };
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
    };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "1";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type AddressDraft = {
  id?: string;
  label: string;
  contactName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
};

const emptyAddress = (): AddressDraft => ({
  label: "",
  contactName: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  isDefault: false,
});

type CatalogViewMode = "list" | "grid";

function B2bCatalogQtyField({
  productId,
  value,
  onChange,
  compact = false,
}: {
  productId: string;
  value: number;
  onChange: (productId: string, next: number) => void;
  compact?: boolean;
}) {
  return (
    <label className={`catalog-admin-field b2b-catalog-qty${compact ? " b2b-catalog-qty--compact" : ""}`}>
      <span>Qty</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) =>
          onChange(productId, Math.max(0, Math.floor(Number(e.target.value) || 0)))
        }
      />
    </label>
  );
}

export default function B2bPortalClient({ slug }: { slug: string }) {
  const [data, setData] = useState<PortalPayload | null>(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [checkoutFeedback, setCheckoutFeedback] = useState("");
  const [orderComplete, setOrderComplete] = useState<"invoice" | "paid" | null>(null);
  const [payNowAvailable, setPayNowAvailable] = useState(false);
  const [addresses, setAddresses] = useState<B2bDeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddress());
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [catalogBrand, setCatalogBrand] = useState("");
  const [catalogSort, setCatalogSort] = useState<B2bCatalogSort>("name_asc");
  const [catalogQuickFilter, setCatalogQuickFilter] = useState<B2bCatalogQuickFilter>("all");
  const [catalogViewMode, setCatalogViewMode] = useState<CatalogViewMode>("list");
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    const savedView = window.localStorage.getItem("maroma-b2b-catalog-view");
    if (savedView === "grid" || savedView === "list") {
      setCatalogViewMode(savedView);
    }
  }, []);

  const changeCatalogView = (nextView: CatalogViewMode) => {
    setCatalogViewMode(nextView);
    window.localStorage.setItem("maroma-b2b-catalog-view", nextView);
  };

  const setProductQty = useCallback((productId: string, next: number) => {
    setQty((current) => ({ ...current, [productId]: next }));
  }, []);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/b2b/${encodeURIComponent(slug)}`, { cache: "no-store" });
    const payload = (await res.json()) as PortalPayload;
    if (!res.ok) {
      setError(payload.error || "Could not load this B2B page.");
      return;
    }
    setData(payload);
    setPayNowAvailable(Boolean(payload.payments?.payNowAvailable));
    const nextAddresses = payload.company.deliveryAddresses ?? [];
    setAddresses(nextAddresses);
    const preferred =
      nextAddresses.find((a) => a.isDefault)?.id || nextAddresses[0]?.id || "";
    setSelectedAddressId((current) =>
      current && nextAddresses.some((a) => a.id === current) ? current : preferred
    );
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

  const catalogCategories = useMemo(
    () => (data ? listB2bCatalogCategories(data.assortment) : []),
    [data]
  );
  const catalogBrands = useMemo(
    () => (data ? listB2bCatalogBrands(data.assortment) : []),
    [data]
  );
  const visibleAssortment = useMemo(
    () =>
      data
        ? filterB2bCatalog(
            data.assortment,
            {
              query: catalogQuery,
              category: catalogCategory,
              brand: catalogBrand,
              sort: catalogSort,
              quick: catalogQuickFilter,
            },
            qty
          )
        : [],
    [data, catalogQuery, catalogCategory, catalogBrand, catalogSort, catalogQuickFilter, qty]
  );

  const persistAddresses = async (next: B2bDeliveryAddress[]) => {
    setSavingAddress(true);
    setStatus("");
    const res = await fetch(`/api/b2b/${encodeURIComponent(slug)}/addresses`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses: next }),
    });
    const payload = (await res.json()) as {
      error?: string;
      deliveryAddresses?: B2bDeliveryAddress[];
    };
    setSavingAddress(false);
    if (!res.ok) {
      setStatus(payload.error || "Could not save delivery addresses.");
      return false;
    }
    const saved = payload.deliveryAddresses ?? next;
    setAddresses(saved);
    if (data) {
      setData({ ...data, company: { ...data.company, deliveryAddresses: saved } });
    }
    const preferred = saved.find((a) => a.isDefault)?.id || saved[0]?.id || "";
    setSelectedAddressId((current) =>
      current && saved.some((a) => a.id === current) ? current : preferred
    );
    return true;
  };

  const startAddAddress = () => {
    setEditingAddressId(null);
    setAddressDraft({ ...emptyAddress(), isDefault: addresses.length === 0 });
    setShowAddressForm(true);
  };

  const startEditAddress = (address: B2bDeliveryAddress) => {
    setEditingAddressId(address.id);
    setAddressDraft({ ...address });
    setShowAddressForm(true);
  };

  const saveAddressForm = async () => {
    const draft: B2bDeliveryAddress = {
      id: editingAddressId || crypto.randomUUID(),
      label: addressDraft.label.trim(),
      contactName: addressDraft.contactName.trim(),
      phone: addressDraft.phone.trim(),
      address: addressDraft.address.trim(),
      city: addressDraft.city.trim(),
      state: addressDraft.state.trim(),
      pincode: addressDraft.pincode.trim(),
      country: addressDraft.country.trim() || "India",
      isDefault: addressDraft.isDefault || addresses.length === 0,
    };
    if (
      !draft.label ||
      !draft.contactName ||
      !draft.phone ||
      !draft.address ||
      !draft.city ||
      !draft.pincode
    ) {
      setStatus("Fill label, contact, phone, address, city, and pincode.");
      return;
    }
    let next = editingAddressId
      ? addresses.map((a) => (a.id === editingAddressId ? draft : a))
      : [...addresses, draft];
    if (draft.isDefault) {
      next = next.map((a) => ({ ...a, isDefault: a.id === draft.id }));
    }
    const ok = await persistAddresses(next);
    if (ok) {
      setShowAddressForm(false);
      setAddressDraft(emptyAddress());
      setEditingAddressId(null);
      setSelectedAddressId(draft.id);
      setCheckoutFeedback("");
      setStatus(editingAddressId ? "Delivery address updated." : "Delivery address saved.");
    }
  };

  const removeAddress = async (id: string) => {
    if (!window.confirm("Remove this delivery address?")) return;
    const next = addresses.filter((a) => a.id !== id);
    if (next.length > 0 && !next.some((a) => a.isDefault)) {
      next[0] = { ...next[0], isDefault: true };
    }
    const ok = await persistAddresses(next);
    if (ok) setStatus("Delivery address removed.");
  };

  const setDefaultAddress = async (id: string) => {
    const next = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    const ok = await persistAddresses(next);
    if (ok) {
      setSelectedAddressId(id);
      setStatus("Default delivery address updated.");
    }
  };

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
    setStatus(
      `Quote request sent (₹${(payload.subtotalInr ?? subtotal).toFixed(2)}). Maroma will follow up.`
    );
    setBusy(false);
  };

  const ensureCheckoutReady = () => {
    if (lines.length === 0) {
      setCheckoutFeedback("Add quantities for at least one product.");
      return false;
    }
    if (addresses.length === 0 || !selectedAddressId) {
      setCheckoutFeedback("Add and select a delivery address above, then continue.");
      setShowAddressForm(true);
      if (addresses.length === 0) {
        setEditingAddressId(null);
        setAddressDraft({ ...emptyAddress(), isDefault: true });
      }
      document.getElementById("b2b-delivery-addresses")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return false;
    }
    return true;
  };

  const confirmRazorpayPayment = async (
    orderId: string,
    response: RazorpaySuccessResponse
  ) => {
    const res = await fetch(`/api/b2b/${encodeURIComponent(slug)}/pay/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      }),
    });
    const payload = (await res.json()) as { error?: string; subtotalInr?: number };
    if (!res.ok) {
      throw new Error(payload.error || "Payment received but confirmation failed. Contact Maroma.");
    }
    const ok = `Payment received (₹${(payload.subtotalInr ?? subtotal).toFixed(2)}). Thank you — Maroma will fulfil your order.`;
    setCheckoutFeedback(ok);
    setStatus(ok);
    setOrderComplete("paid");
    setMessage("");
  };

  const openRazorpayCheckout = async (orderId: string, session: RazorpayCheckoutSession) => {
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      throw new Error("Could not load Razorpay checkout. Please try again.");
    }
    await new Promise<void>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        name: session.name,
        description: session.description,
        order_id: session.orderId,
        prefill: session.prefill,
        theme: { color: "#134a57" },
        handler: (response: RazorpaySuccessResponse) => {
          void confirmRazorpayPayment(orderId, response)
            .then(() => resolve())
            .catch((err) =>
              reject(err instanceof Error ? err : new Error("Payment confirm failed."))
            );
        },
        modal: {
          ondismiss: () => {
            reject(
              new Error(
                "Payment cancelled. Try Pay now again, or place an invoice order."
              )
            );
          },
        },
      });
      rzp.on("payment.failed", (response) => {
        reject(new Error(response.error?.description || "Payment failed."));
      });
      rzp.open();
    });
  };

  const submitOrder = async (paymentMode: "invoice" | "pay_now") => {
    if (!data) return;
    if (!ensureCheckoutReady()) return;
    setBusy(true);
    setCheckoutFeedback("");
    setStatus("");
    try {
      const res = await fetch(`/api/b2b/${encodeURIComponent(slug)}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          deliveryAddressId: selectedAddressId,
          paymentMode,
          lines: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      });
      let payload: {
        error?: string;
        subtotalInr?: number;
        orderId?: string;
        razorpay?: RazorpayCheckoutSession;
      } = {};
      try {
        payload = (await res.json()) as typeof payload;
      } catch {
        payload = { error: "Could not read the server response." };
      }
      if (!res.ok) {
        const msg = payload.error || "Could not place order.";
        setCheckoutFeedback(msg);
        setStatus(msg);
        return;
      }

      if (paymentMode === "pay_now") {
        if (!payload.orderId || !payload.razorpay) {
          throw new Error("Payment session was not created.");
        }
        setCheckoutFeedback("Opening secure payment…");
        await openRazorpayCheckout(payload.orderId, payload.razorpay);
        return;
      }

      const ok = `Order placed (₹${(payload.subtotalInr ?? subtotal).toFixed(2)}). Maroma will confirm and invoice.`;
      setCheckoutFeedback(ok);
      setStatus(ok);
      setOrderComplete("invoice");
      setMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error placing order.";
      setCheckoutFeedback(msg);
      setStatus(msg);
    } finally {
      setBusy(false);
    }
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
      <main className="catalog-admin-page b2b-portal-page">
        <p className="catalog-admin-empty">Loading private catalogue…</p>
      </main>
    );
  }

  const isQuote = data.company.commerceMode === "quote";
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;
  const isFullCatalog =
    data.company.program === "white_label" || data.company.program === "branded";
  const minSpend = data.company.whiteLabelMinSpendInr ?? 0;
  const discountPct = data.company.whiteLabelDiscountPercent ?? 35;
  const programHeadline =
    data.company.program === "branded"
      ? `Branded programme: full catalogue at ${discountPct}% off. Minimum order ₹${minSpend.toLocaleString("en-IN")}.`
      : data.company.program === "white_label"
        ? `White-label programme: full catalogue at ${discountPct}% off. Minimum order ₹${minSpend.toLocaleString("en-IN")}.`
        : "Restricted assortment with your negotiated rates.";
  const remainingMin = Math.max(0, minSpend - subtotal);

  const clearCatalogFilters = () => {
    setCatalogQuery("");
    setCatalogCategory("");
    setCatalogBrand("");
    setCatalogSort("name_asc");
    setCatalogQuickFilter("all");
  };

  const renderCatalogProductMeta = (row: AssortmentRow) => (
    <>
      <strong>{decodeBasicHtmlEntities(row.name)}</strong>
      <div className="catalog-admin-card-copy b2b-catalog-meta">
        <span>
          {row.sku} · MOQ {row.moq}
        </span>
        {row.primaryCategory ? <span>{row.primaryCategory}</span> : null}
        {row.brand ? <span>{row.brand}</span> : null}
        <span>
          Your price: {formatInrPrice(String(row.priceInr)) ?? `₹${row.priceInr}`}
          {row.retailPriceInr != null && row.retailPriceInr > row.priceInr ? (
            <>
              {" "}
              · Retail {formatInrPrice(String(row.retailPriceInr)) ?? `₹${row.retailPriceInr}`}
            </>
          ) : null}
        </span>
      </div>
    </>
  );

  return (
    <main className="catalog-admin-page b2b-portal-page">
      <div className="catalog-admin-shell catalog-admin-shell--edit">
        <header className="catalog-admin-header">
          <div>
            <p className="catalog-admin-back" style={{ opacity: 0.7 }}>
              Maroma B2B · Private
            </p>
            <h1>{data.company.name}</h1>
            <p className="catalog-admin-lede">
              {isFullCatalog ? programHeadline : "Restricted assortment with your negotiated rates."}
              {isQuote
                ? " Submit a quote request — Maroma will confirm availability and invoicing."
                : " Checkout with negotiated rates — pay now or request an invoice."}
              {data.viewer.isAdmin ? " (Admin preview)" : null}
            </p>
          </div>
          <div className="catalog-admin-header-actions">
            <Link href="/?skipIntro=1#shop" className="button secondary">
              Shop
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
            {isFullCatalog ? (
              <p className="catalog-admin-card-copy">
                {remainingMin > 0
                  ? `Add ₹${remainingMin.toLocaleString("en-IN")} more to reach the ₹${minSpend.toLocaleString("en-IN")} minimum.`
                  : `Minimum spend of ₹${minSpend.toLocaleString("en-IN")} met.`}
              </p>
            ) : null}

            <div className="b2b-catalog-toolbar catalog-admin-toolbar">
              <div className="catalog-admin-search">
                <input
                  type="search"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Search by name, SKU, category, or brand"
                  aria-label="Search catalogue"
                />
              </div>

              <div className="catalog-admin-filters b2b-catalog-filters">
                <select
                  value={catalogCategory}
                  onChange={(e) => setCatalogCategory(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="">All categories</option>
                  {catalogCategories.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>

                {catalogBrands.length > 0 ? (
                  <select
                    value={catalogBrand}
                    onChange={(e) => setCatalogBrand(e.target.value)}
                    aria-label="Filter by brand"
                  >
                    <option value="">All brands</option>
                    {catalogBrands.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                ) : null}

                <select
                  value={catalogSort}
                  onChange={(e) => setCatalogSort(e.target.value as B2bCatalogSort)}
                  aria-label="Sort products"
                >
                  <option value="name_asc">Name A–Z</option>
                  <option value="name_desc">Name Z–A</option>
                  <option value="price_asc">Price low to high</option>
                  <option value="price_desc">Price high to low</option>
                  <option value="sku_asc">SKU</option>
                </select>

                <div className="catalog-admin-status-tabs b2b-catalog-quick-tabs" role="group" aria-label="Catalogue filters">
                  <button
                    type="button"
                    aria-pressed={catalogQuickFilter === "all"}
                    className={`catalog-admin-status-tab catalog-admin-status-tab--all${catalogQuickFilter === "all" ? " is-active" : ""}`}
                    onClick={() => setCatalogQuickFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    aria-pressed={catalogQuickFilter === "in_order"}
                    className={`catalog-admin-status-tab${catalogQuickFilter === "in_order" ? " is-active" : ""}`}
                    onClick={() => setCatalogQuickFilter("in_order")}
                  >
                    In order
                  </button>
                  <button
                    type="button"
                    aria-pressed={catalogQuickFilter === "moq"}
                    className={`catalog-admin-status-tab${catalogQuickFilter === "moq" ? " is-active" : ""}`}
                    onClick={() => setCatalogQuickFilter("moq")}
                  >
                    MOQ &gt; 1
                  </button>
                  <span className="catalog-admin-filter-results" aria-live="polite">
                    {visibleAssortment.length.toLocaleString()} of {data.assortment.length.toLocaleString()}
                  </span>
                  <div className="catalog-admin-view-toggle" role="group" aria-label="Catalogue view">
                    <button
                      type="button"
                      className={catalogViewMode === "list" ? "is-active" : ""}
                      aria-pressed={catalogViewMode === "list"}
                      onClick={() => changeCatalogView("list")}
                    >
                      <span aria-hidden>☰</span> List
                    </button>
                    <button
                      type="button"
                      className={catalogViewMode === "grid" ? "is-active" : ""}
                      aria-pressed={catalogViewMode === "grid"}
                      onClick={() => changeCatalogView("grid")}
                    >
                      <span aria-hidden>▦</span> Grid
                    </button>
                  </div>
                </div>

                {catalogQuery || catalogCategory || catalogBrand || catalogQuickFilter !== "all" ? (
                  <button type="button" className="button secondary b2b-catalog-clear" onClick={clearCatalogFilters}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>

            {visibleAssortment.length === 0 ? (
              <p className="catalog-admin-empty">No products match your filters.</p>
            ) : catalogViewMode === "list" ? (
              <div className="b2b-catalog-list">
                {visibleAssortment.map((row) => (
                  <article key={row.productId} className="b2b-catalog-row">
                    <div className="b2b-catalog-thumb">
                      {row.imageUrl ? <img src={row.imageUrl} alt="" /> : null}
                    </div>
                    <div className="b2b-catalog-copy">{renderCatalogProductMeta(row)}</div>
                    <B2bCatalogQtyField
                      productId={row.productId}
                      value={qty[row.productId] ?? 0}
                      onChange={setProductQty}
                    />
                  </article>
                ))}
              </div>
            ) : (
              <div className="b2b-catalog-grid">
                {visibleAssortment.map((row) => (
                  <article key={row.productId} className="b2b-catalog-card">
                    <div className="b2b-catalog-card-image">
                      {row.imageUrl ? <img src={row.imageUrl} alt="" /> : <span aria-hidden>◇</span>}
                    </div>
                    <div className="b2b-catalog-card-body">
                      {renderCatalogProductMeta(row)}
                      <B2bCatalogQtyField
                        productId={row.productId}
                        value={qty[row.productId] ?? 0}
                        onChange={setProductQty}
                        compact
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="catalog-admin-card" id="b2b-delivery-addresses">
          <div className="b2b-section-head">
            <h2>Delivery addresses</h2>
            <button type="button" className="button secondary" onClick={startAddAddress}>
              Add address
            </button>
          </div>
          {addresses.length === 0 ? (
            <p className="catalog-admin-card-copy">
              Save at least one delivery location before placing an order.
            </p>
          ) : (
            <div className="b2b-address-list">
              {addresses.map((address) => (
                <article
                  key={address.id}
                  className={`b2b-address-card${selectedAddressId === address.id ? " is-selected" : ""}`}
                >
                  <label className="b2b-address-select">
                    <input
                      type="radio"
                      name="delivery-address"
                      checked={selectedAddressId === address.id}
                      onChange={() => setSelectedAddressId(address.id)}
                    />
                    <div>
                      <strong>
                        {address.label}
                        {address.isDefault ? " · Default" : ""}
                      </strong>
                      <small>
                        {address.contactName} · {address.phone}
                        <br />
                        {address.address}, {address.city}
                        {address.state ? `, ${address.state}` : ""} {address.pincode},{" "}
                        {address.country}
                      </small>
                    </div>
                  </label>
                  <div className="b2b-address-actions">
                    {!address.isDefault ? (
                      <button
                        type="button"
                        className="button secondary"
                        disabled={savingAddress}
                        onClick={() => void setDefaultAddress(address.id)}
                      >
                        Set default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => startEditAddress(address)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={savingAddress}
                      onClick={() => void removeAddress(address.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {showAddressForm ? (
            <div className="b2b-address-form">
              <h3>{editingAddressId ? "Edit address" : "New address"}</h3>
              <div className="b2b-address-form-grid">
                <label className="catalog-admin-field">
                  <span>Label</span>
                  <input
                    value={addressDraft.label}
                    onChange={(e) => setAddressDraft((d) => ({ ...d, label: e.target.value }))}
                    placeholder="Warehouse · Mumbai"
                  />
                </label>
                <label className="catalog-admin-field">
                  <span>Contact name</span>
                  <input
                    value={addressDraft.contactName}
                    onChange={(e) =>
                      setAddressDraft((d) => ({ ...d, contactName: e.target.value }))
                    }
                  />
                </label>
                <label className="catalog-admin-field">
                  <span>Phone</span>
                  <input
                    value={addressDraft.phone}
                    onChange={(e) => setAddressDraft((d) => ({ ...d, phone: e.target.value }))}
                  />
                </label>
                <label className="catalog-admin-field b2b-address-span">
                  <span>Street address</span>
                  <input
                    value={addressDraft.address}
                    onChange={(e) => setAddressDraft((d) => ({ ...d, address: e.target.value }))}
                  />
                </label>
                <label className="catalog-admin-field">
                  <span>City</span>
                  <input
                    value={addressDraft.city}
                    onChange={(e) => setAddressDraft((d) => ({ ...d, city: e.target.value }))}
                  />
                </label>
                <label className="catalog-admin-field">
                  <span>State</span>
                  <input
                    value={addressDraft.state}
                    onChange={(e) => setAddressDraft((d) => ({ ...d, state: e.target.value }))}
                  />
                </label>
                <label className="catalog-admin-field">
                  <span>Pincode</span>
                  <input
                    value={addressDraft.pincode}
                    onChange={(e) => setAddressDraft((d) => ({ ...d, pincode: e.target.value }))}
                  />
                </label>
                <label className="catalog-admin-field">
                  <span>Country</span>
                  <input
                    value={addressDraft.country}
                    onChange={(e) => setAddressDraft((d) => ({ ...d, country: e.target.value }))}
                  />
                </label>
              </div>
              <label
                className="catalog-admin-field"
                style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <input
                  type="checkbox"
                  checked={addressDraft.isDefault}
                  onChange={(e) =>
                    setAddressDraft((d) => ({ ...d, isDefault: e.target.checked }))
                  }
                />
                <span>Default delivery address</span>
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="button primary button-sage"
                  disabled={savingAddress}
                  onClick={() => void saveAddressForm()}
                >
                  {savingAddress ? "Saving…" : "Save address"}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setShowAddressForm(false);
                    setEditingAddressId(null);
                    setAddressDraft(emptyAddress());
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="catalog-admin-card" id="b2b-order-review">
          <h2>{isQuote ? "Review quote" : "Review order"}</h2>
          {lines.length === 0 ? (
            <p className="catalog-admin-card-copy">
              Set quantities above to build your {isQuote ? "quote" : "order"} summary.
            </p>
          ) : (
            <>
              <div className="b2b-summary-table-wrap">
                <table className="b2b-summary-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Total</th>
                      <th>
                        <span className="visually-hidden">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.productId}>
                        <td>
                          <strong>{decodeBasicHtmlEntities(line.name)}</strong>
                          <small>
                            {line.sku}
                            {line.moq > 1 ? ` · MOQ ${line.moq}` : ""}
                          </small>
                        </td>
                        <td>
                          <input
                            className="b2b-summary-qty"
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`Quantity for ${decodeBasicHtmlEntities(line.name)}`}
                            value={qty[line.productId] ?? 0}
                            onChange={(e) =>
                              setQty((current) => ({
                                ...current,
                                [line.productId]: Math.max(
                                  0,
                                  Math.floor(Number(e.target.value) || 0)
                                ),
                              }))
                            }
                          />
                        </td>
                        <td>{formatInrPrice(String(line.priceInr)) ?? `₹${line.priceInr}`}</td>
                        <td>
                          {formatInrPrice(String(line.lineTotal)) ?? `₹${line.lineTotal}`}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="button secondary b2b-summary-remove"
                            aria-label={`Remove ${decodeBasicHtmlEntities(line.name)}`}
                            onClick={() =>
                              setQty((current) => ({
                                ...current,
                                [line.productId]: 0,
                              }))
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="b2b-summary-meta">
                {!isQuote ? (
                  <div>
                    <span>Delivery</span>
                    {selectedAddress ? (
                      <p>
                        <strong>{selectedAddress.label}</strong>
                        <br />
                        {selectedAddress.contactName} · {selectedAddress.phone}
                        <br />
                        {selectedAddress.address}, {selectedAddress.city}
                        {selectedAddress.state ? `, ${selectedAddress.state}` : ""}{" "}
                        {selectedAddress.pincode}, {selectedAddress.country}
                      </p>
                    ) : (
                      <p className="catalog-admin-card-copy">Select a delivery address above.</p>
                    )}
                  </div>
                ) : null}
                <div className="b2b-summary-total">
                  <span>
                    {lines.length} line{lines.length === 1 ? "" : "s"}
                  </span>
                  <strong>
                    Subtotal {formatInrPrice(String(subtotal)) ?? `₹${subtotal}`}
                  </strong>
                </div>
              </div>
            </>
          )}

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
            <>
              <p className="catalog-admin-card-copy">
                Review the summary above, then pay now with Razorpay or place an order for invoice.
              </p>
              {checkoutFeedback ? (
                <p
                  className={`catalog-admin-status${
                    orderComplete ||
                    checkoutFeedback.startsWith("Order placed") ||
                    checkoutFeedback.startsWith("Payment received")
                      ? " catalog-admin-status--ok"
                      : " catalog-admin-status--error"
                  }`}
                  style={{ marginBottom: 12 }}
                >
                  {checkoutFeedback}
                </p>
              ) : null}
              {orderComplete ? (
                <div className="b2b-checkout-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setOrderComplete(null);
                      setCheckoutFeedback("");
                      setStatus("");
                    }}
                  >
                    Place another order
                  </button>
                </div>
              ) : (
                <div className="b2b-checkout-actions">
                  <button
                    type="button"
                    className="button primary button-sage"
                    disabled={busy || lines.length === 0}
                    onClick={() => void submitOrder("pay_now")}
                  >
                    {busy ? "Working…" : "Pay now"}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || lines.length === 0}
                    onClick={() => void submitOrder("invoice")}
                  >
                    {busy ? "Working…" : "Place order (invoice)"}
                  </button>
                </div>
              )}
              {!payNowAvailable && !orderComplete ? (
                <p className="catalog-admin-card-copy" style={{ marginTop: 10 }}>
                  Online Pay now needs Razorpay keys on the server. Until then, use Place order
                  (invoice).
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
