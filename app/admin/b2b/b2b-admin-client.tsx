"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  B2bAssortmentItem,
  B2bCommerceMode,
  B2bCompany,
  B2bCompanyStatus,
  B2bOrder,
  B2bQuoteRequest,
} from "../../../lib/b2b-types";
import { decodeBasicHtmlEntities } from "../../../lib/decode-html-entities";
import type { AdminProductSummary } from "../../../lib/product-catalog-admin";
import "./b2b-admin.css";

type Draft = {
  id?: string;
  name: string;
  slug: string;
  userEmail: string;
  commerceMode: B2bCommerceMode;
  status: B2bCompanyStatus;
  notes: string;
  assortment: B2bAssortmentItem[];
};

type Panel = "overview" | "form";

const emptyDraft = (): Draft => ({
  name: "",
  slug: "",
  userEmail: "",
  commerceMode: "quote",
  status: "active",
  notes: "",
  assortment: [],
});

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function B2bAdminClient() {
  const [panel, setPanel] = useState<Panel>("overview");
  const [companies, setCompanies] = useState<B2bCompany[]>([]);
  const [quotes, setQuotes] = useState<B2bQuoteRequest[]>([]);
  const [orders, setOrders] = useState<B2bOrder[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [successLabel, setSuccessLabel] = useState("Company Created!");
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [lastWelcome, setLastWelcome] = useState<{
    sent: boolean;
    temporaryPassword?: string;
    error?: string;
    accountCreated?: boolean;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminProductSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/b2b/companies", { cache: "no-store" });
    const data = (await res.json()) as {
      companies?: B2bCompany[];
      quotes?: B2bQuoteRequest[];
      orders?: B2bOrder[];
      error?: string;
    };
    if (!res.ok) {
      setStatus(data.error || "Could not load B2B companies.");
      setLoading(false);
      return;
    }
    setCompanies(data.companies ?? []);
    setQuotes(data.quotes ?? []);
    setOrders(data.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editing = Boolean(draft.id);

  const stats = useMemo(() => {
    const active = companies.filter((c) => c.status === "active").length;
    const pending = companies.filter((c) => c.status === "pending").length;
    const paused = companies.filter((c) => c.status === "paused").length;
    const quoteMode = companies.filter((c) => c.commerceMode === "quote").length;
    const checkoutMode = companies.filter((c) => c.commerceMode === "checkout").length;
    const skus = companies.reduce((sum, c) => sum + c.assortment.length, 0);
    const addresses = companies.reduce((sum, c) => sum + (c.deliveryAddresses?.length ?? 0), 0);
    const received = quotes.filter((q) => q.status === "received");
    const quoteValue = quotes.reduce((sum, q) => sum + (q.subtotalInr || 0), 0);
    const openOrders = orders.filter(
      (o) => o.status === "received" || o.status === "confirmed" || o.status === "awaiting_payment"
    );
    const orderValue = orders.reduce((sum, o) => sum + (o.subtotalInr || 0), 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const quotesThisMonth = quotes.filter((q) => new Date(q.createdAt) >= monthStart).length;
    const ordersThisMonth = orders.filter((o) => new Date(o.createdAt) >= monthStart).length;
    return {
      total: companies.length,
      active,
      pending,
      paused,
      quoteMode,
      checkoutMode,
      skus,
      addresses,
      quotes: quotes.length,
      received: received.length,
      quoteValue,
      quotesThisMonth,
      orders: orders.length,
      openOrders: openOrders.length,
      orderValue,
      ordersThisMonth,
    };
  }, [companies, quotes, orders]);

  const openCompany = (company: B2bCompany) => {
    setSaveSucceeded(false);
    setLastWelcome(null);
    setSendWelcomeEmail(false);
    setDraft({
      id: company.id,
      name: company.name,
      slug: company.slug,
      userEmail: company.userEmail,
      commerceMode: company.commerceMode,
      status: company.status,
      notes: company.notes ?? "",
      assortment: company.assortment.map((a) => ({ ...a })),
    });
    setStatus(`Editing ${company.name}`);
    setPanel("form");
  };

  const startCreate = () => {
    setSaveSucceeded(false);
    setLastWelcome(null);
    setSendWelcomeEmail(true);
    setDraft(emptyDraft());
    setStatus("");
    setPanel("form");
  };

  const save = async () => {
    setSaving(true);
    setSaveSucceeded(false);
    setLastWelcome(null);
    setStatus("");
    const wasCreate = !draft.id;
    const res = await fetch("/api/admin/b2b/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        sendWelcomeEmail,
      }),
    });
    const data = (await res.json()) as {
      company?: B2bCompany;
      error?: string;
      welcomeEmail?: {
        sent: boolean;
        temporaryPassword?: string;
        error?: string;
        accountCreated?: boolean;
        passwordReset?: boolean;
      };
    };
    if (!res.ok) {
      setStatus(data.error || "Save failed.");
      setSaving(false);
      return;
    }
    const welcome = data.welcomeEmail;
    if (welcome) {
      setLastWelcome({
        sent: welcome.sent,
        temporaryPassword: welcome.temporaryPassword,
        error: welcome.error,
        accountCreated: welcome.accountCreated,
      });
    }
    const welcomeNote = welcome
      ? welcome.sent
        ? ` Welcome email sent to ${data.company?.userEmail}.`
        : ` Welcome email not sent${welcome.error ? `: ${welcome.error}` : "."}`
      : "";
    setStatus(`Saved ${data.company?.name}. Page: /b2b/${data.company?.slug}.${welcomeNote}`);
    setDraft(emptyDraft());
    setSendWelcomeEmail(true);
    setSuccessLabel(wasCreate ? "Company Created!" : "Company Updated!");
    setSaveSucceeded(true);
    await load();
    setSaving(false);
    window.setTimeout(() => {
      setSaveSucceeded(false);
      setPanel("overview");
    }, 1600);
  };

  const remove = async (company: B2bCompany) => {
    if (!window.confirm(`Delete B2B page for ${company.name}?`)) return;
    const res = await fetch(`/api/admin/b2b/companies?id=${encodeURIComponent(company.id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setStatus(data.error || "Delete failed.");
      return;
    }
    if (draft.id === company.id) setDraft(emptyDraft());
    setStatus(`Deleted ${company.name}.`);
    await load();
  };

  const searchProducts = async () => {
    const params = new URLSearchParams({ q: query, limit: "25", status: "all" });
    const data = await fetch(`/api/admin/products?${params}`, { cache: "no-store" }).then((r) =>
      r.json()
    );
    setResults(data.products ?? []);
  };

  const addProduct = (product: AdminProductSummary) => {
    if (draft.assortment.some((a) => a.productId === product.id)) {
      setStatus("Already in assortment.");
      return;
    }
    const retail =
      (product.priceNumber != null && Number.isFinite(product.priceNumber)
        ? product.priceNumber
        : Number(String(product.price ?? "").replace(/,/g, ""))) || 0;
    setDraft((d) => ({
      ...d,
      assortment: [...d.assortment, { productId: product.id, priceInr: retail || 0, moq: 1 }],
    }));
  };

  const pageUrl = useMemo(() => {
    const slug = draft.slug || slugify(draft.name);
    return slug ? `/b2b/${slug}` : "";
  }, [draft.slug, draft.name]);

  return (
    <main className="catalog-admin-page b2b-admin-page">
      <div className="catalog-admin-shell catalog-admin-shell--edit">
        <header className="catalog-admin-header">
          <div>
            <Link href="/admin" className="catalog-admin-back">
              ← Admin
            </Link>
            <h1>B2B overview</h1>
            <p className="catalog-admin-lede">
              Wholesale clients, private pages, quote pipeline, and assortment coverage.
            </p>
          </div>
          <div className="catalog-admin-header-actions">
            {panel === "form" ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setPanel("overview");
                  setDraft(emptyDraft());
                  setSendWelcomeEmail(true);
                  setLastWelcome(null);
                }}
              >
                Back to overview
              </button>
            ) : (
              <button type="button" className="button primary button-sage" onClick={startCreate}>
                Add company
              </button>
            )}
          </div>
        </header>

        {status ? <p className="catalog-admin-status catalog-admin-status--ok">{status}</p> : null}

        {panel === "overview" ? (
          <>
            <section className="b2b-kpi-grid" aria-label="B2B summary">
              <article>
                <span>Companies</span>
                <strong>{stats.total}</strong>
                <small>
                  {stats.active} active · {stats.pending} pending · {stats.paused} paused
                </small>
              </article>
              <article className={stats.active ? "is-healthy" : undefined}>
                <span>Active pages</span>
                <strong>{stats.active}</strong>
                <small>
                  {stats.quoteMode} quote · {stats.checkoutMode} checkout · {stats.addresses}{" "}
                  addresses
                </small>
              </article>
              <article className={stats.openOrders ? "is-attention" : "is-healthy"}>
                <span>Orders</span>
                <strong>{money.format(stats.orderValue)}</strong>
                <small>
                  {stats.orders} total · {stats.openOrders} open · {stats.ordersThisMonth} this month
                </small>
              </article>
              <article className={stats.received ? "is-attention" : "is-healthy"}>
                <span>Quote pipeline</span>
                <strong>{money.format(stats.quoteValue)}</strong>
                <small>
                  {stats.quotes} total · {stats.received} open · {stats.quotesThisMonth} this month
                </small>
              </article>
            </section>

            {loading ? <p className="catalog-admin-empty">Loading B2B overview…</p> : null}

            <section className="catalog-admin-card">
              <div className="b2b-section-head">
                <h2>Companies</h2>
                <button type="button" className="button secondary" onClick={startCreate}>
                  Add company
                </button>
              </div>
              {companies.length === 0 ? (
                <p className="catalog-admin-card-copy">
                  No B2B clients yet. Create a company to issue a private `/b2b/[slug]` page.
                </p>
              ) : (
                <div className="b2b-table-wrap">
                  <table className="b2b-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Mode</th>
                        <th>SKUs</th>
                        <th>Addresses</th>
                        <th>Updated</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((company) => (
                        <tr key={company.id}>
                          <td>
                            <strong>{company.name}</strong>
                            <small>
                              /b2b/{company.slug}
                              <br />
                              {company.userEmail}
                            </small>
                          </td>
                          <td>
                            <span className={`b2b-pill b2b-pill--${company.status}`}>
                              {company.status}
                            </span>
                          </td>
                          <td>{company.commerceMode === "quote" ? "Quote" : "Checkout"}</td>
                          <td>{company.assortment.length}</td>
                          <td>{company.deliveryAddresses?.length ?? 0}</td>
                          <td>
                            {new Date(company.updatedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="b2b-table-actions">
                            <Link
                              className="button secondary"
                              href={`/b2b/${company.slug}`}
                              target="_blank"
                            >
                              Open
                            </Link>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => openCompany(company)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => void remove(company)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="catalog-admin-card">
              <h2>Recent orders</h2>
              {orders.length === 0 ? (
                <p className="catalog-admin-card-copy">No wholesale orders yet.</p>
              ) : (
                <div className="b2b-quote-list">
                  {orders.map((o) => (
                    <article key={o.id} className="b2b-quote-row">
                      <div>
                        <strong>
                          {o.companyName} — {money.format(o.subtotalInr)}
                        </strong>
                        <small>
                          {new Date(o.createdAt).toLocaleString("en-IN")} · {o.userEmail} ·{" "}
                          {o.lines.length} lines · {o.status} · {o.deliveryAddress.label} (
                          {o.deliveryAddress.city})
                          {o.message ? ` · ${o.message}` : ""}
                        </small>
                      </div>
                      <Link className="button secondary" href={`/b2b/${o.companySlug}`} target="_blank">
                        Page
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="catalog-admin-card">
              <h2>Recent quote requests</h2>
              {quotes.length === 0 ? (
                <p className="catalog-admin-card-copy">No quotes yet.</p>
              ) : (
                <div className="b2b-quote-list">
                  {quotes.map((q) => (
                    <article key={q.id} className="b2b-quote-row">
                      <div>
                        <strong>
                          {q.companyName} — {money.format(q.subtotalInr)}
                        </strong>
                        <small>
                          {new Date(q.createdAt).toLocaleString("en-IN")} · {q.userEmail} ·{" "}
                          {q.lines.length} lines · {q.status}
                          {q.message ? ` · ${q.message}` : ""}
                        </small>
                      </div>
                      <Link className="button secondary" href={`/b2b/${q.companySlug}`} target="_blank">
                        Page
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="catalog-admin-card">
            <h2>{editing ? "Edit company" : "New company"}</h2>
            <div className="gift-packing-dimension-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <label className="catalog-admin-field">
                <span>Company name</span>
                <input
                  value={draft.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setDraft((d) => ({
                      ...d,
                      name,
                      slug: d.id ? d.slug : slugify(name),
                    }));
                  }}
                  placeholder="Ananda Spa"
                />
              </label>
              <label className="catalog-admin-field">
                <span>URL slug</span>
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))}
                  placeholder="ananda-spa"
                />
              </label>
              <label className="catalog-admin-field">
                <span>Client login email</span>
                <input
                  type="email"
                  value={draft.userEmail}
                  onChange={(e) => setDraft((d) => ({ ...d, userEmail: e.target.value }))}
                  placeholder="buyer@anandaspa.com"
                />
              </label>
              <label className="catalog-admin-field">
                <span>Commerce mode</span>
                <select
                  value={draft.commerceMode}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, commerceMode: e.target.value as B2bCommerceMode }))
                  }
                >
                  <option value="quote">Request quote</option>
                  <option value="checkout">Negotiated rates + checkout</option>
                </select>
              </label>
              <label className="catalog-admin-field">
                <span>Status</span>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, status: e.target.value as B2bCompanyStatus }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="paused">Paused</option>
                </select>
              </label>
            </div>
            <label className="catalog-admin-field">
              <span>Internal notes</span>
              <textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </label>
            <label
              className="catalog-admin-field"
              style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: "row" }}
            >
              <input
                type="checkbox"
                checked={sendWelcomeEmail}
                onChange={(e) => setSendWelcomeEmail(e.target.checked)}
              />
              <span>
                {editing
                  ? "Resend welcome email (resets their password and emails the new one + private page link)"
                  : "Send welcome email with private page link and temporary password"}
              </span>
            </label>
            {pageUrl ? (
              <p className="catalog-admin-card-copy">
                Private page:{" "}
                <Link href={pageUrl} target="_blank">
                  {pageUrl}
                </Link>
              </p>
            ) : null}
            {lastWelcome ? (
              <p className="catalog-admin-card-copy">
                {lastWelcome.sent
                  ? `Welcome email sent.${lastWelcome.accountCreated ? " New login created." : " Existing login password reset."}`
                  : `Welcome email failed${lastWelcome.error ? `: ${lastWelcome.error}` : "."}`}
                {lastWelcome.temporaryPassword ? (
                  <>
                    {" "}
                    Temporary password (share only if email failed):{" "}
                    <strong>{lastWelcome.temporaryPassword}</strong>
                  </>
                ) : null}
              </p>
            ) : null}

            <h3 style={{ marginTop: 24 }}>Restricted assortment</h3>
            <div className="catalog-admin-search">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search catalogue to add SKUs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void searchProducts();
                }}
              />
              <button type="button" className="button secondary" onClick={() => void searchProducts()}>
                Search
              </button>
            </div>
            {results.length ? (
              <div className="gift-packing-result-picker" style={{ marginTop: 12 }}>
                {results.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    className="button secondary"
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      width: "100%",
                      marginBottom: 6,
                    }}
                    onClick={() => addProduct(product)}
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt=""
                        width={36}
                        height={36}
                        style={{ objectFit: "cover" }}
                      />
                    ) : null}
                    <span>
                      <strong>{decodeBasicHtmlEntities(product.name)}</strong>
                      <br />
                      <small>{product.sku}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              {draft.assortment.length === 0 ? (
                <p className="catalog-admin-card-copy">No products assigned yet.</p>
              ) : (
                draft.assortment.map((item, index) => (
                  <div
                    key={item.productId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 100px 80px",
                      gap: 8,
                      alignItems: "end",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13 }}>{item.productId}</strong>
                    </div>
                    <label className="catalog-admin-field">
                      <span>Price ₹</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.priceInr}
                        onChange={(e) => {
                          const priceInr = Number(e.target.value) || 0;
                          setDraft((d) => ({
                            ...d,
                            assortment: d.assortment.map((a, i) =>
                              i === index ? { ...a, priceInr } : a
                            ),
                          }));
                        }}
                      />
                    </label>
                    <label className="catalog-admin-field">
                      <span>MOQ</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.moq}
                        onChange={(e) => {
                          const moq = Math.max(1, Math.floor(Number(e.target.value) || 1));
                          setDraft((d) => ({
                            ...d,
                            assortment: d.assortment.map((a, i) =>
                              i === index ? { ...a, moq } : a
                            ),
                          }));
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          assortment: d.assortment.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className={`button primary button-sage${saveSucceeded ? " process-success" : ""}`}
                disabled={saving}
                onClick={() => void save()}
              >
                {saving
                  ? "Saving…"
                  : saveSucceeded
                    ? successLabel
                    : editing
                      ? "Update company"
                      : "Create company"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setSaveSucceeded(false);
                  setLastWelcome(null);
                  setSendWelcomeEmail(true);
                  setDraft(emptyDraft());
                  setPanel("overview");
                }}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
