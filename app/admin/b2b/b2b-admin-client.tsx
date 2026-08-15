"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { B2bAssortmentItem, B2bCommerceMode, B2bCompany, B2bCompanyStatus, B2bQuoteRequest } from "../../../lib/b2b-types";
import type { AdminProductSummary } from "../../../lib/product-catalog-admin";

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

export default function B2bAdminClient() {
  const [companies, setCompanies] = useState<B2bCompany[]>([]);
  const [quotes, setQuotes] = useState<B2bQuoteRequest[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminProductSummary[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/b2b/companies", { cache: "no-store" });
    const data = (await res.json()) as { companies?: B2bCompany[]; quotes?: B2bQuoteRequest[]; error?: string };
    if (!res.ok) {
      setStatus(data.error || "Could not load B2B companies.");
      return;
    }
    setCompanies(data.companies ?? []);
    setQuotes(data.quotes ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editing = Boolean(draft.id);

  const openCompany = (company: B2bCompany) => {
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
  };

  const save = async () => {
    setSaving(true);
    setStatus("");
    const res = await fetch("/api/admin/b2b/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = (await res.json()) as { company?: B2bCompany; error?: string };
    if (!res.ok) {
      setStatus(data.error || "Save failed.");
      setSaving(false);
      return;
    }
    setStatus(`Saved ${data.company?.name}. Page: /b2b/${data.company?.slug}`);
    setDraft(emptyDraft());
    await load();
    setSaving(false);
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
    const data = await fetch(`/api/admin/products?${params}`, { cache: "no-store" }).then((r) => r.json());
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
      assortment: [
        ...d.assortment,
        { productId: product.id, priceInr: retail || 0, moq: 1 },
      ],
    }));
  };

  const pageUrl = useMemo(() => {
    const slug = draft.slug || slugify(draft.name);
    return slug ? `/b2b/${slug}` : "";
  }, [draft.slug, draft.name]);

  return (
    <main className="catalog-admin-page">
      <div className="catalog-admin-shell catalog-admin-shell--edit">
        <header className="catalog-admin-header">
          <div>
            <Link href="/admin" className="catalog-admin-back">
              ← Admin
            </Link>
            <h1>B2B clients</h1>
            <p className="catalog-admin-lede">
              Private bookmarkable pages with a restricted assortment. Default mode is request quote;
              switch a client to checkout when negotiated rates should use live checkout.
            </p>
          </div>
        </header>

        {status ? <p className="catalog-admin-status catalog-admin-status--ok">{status}</p> : null}

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
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as B2bCompanyStatus }))}
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
          {pageUrl ? (
            <p className="catalog-admin-card-copy">
              Private page:{" "}
              <Link href={pageUrl} target="_blank">
                {pageUrl}
              </Link>
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
                  style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", marginBottom: 6 }}
                  onClick={() => addProduct(product)}
                >
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" width={36} height={36} style={{ objectFit: "cover" }} />
                  ) : null}
                  <span>
                    <strong>{product.name}</strong>
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
                          assortment: d.assortment.map((a, i) => (i === index ? { ...a, moq } : a)),
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
            <button type="button" className="button primary button-sage" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : editing ? "Update company" : "Create company"}
            </button>
            {editing ? (
              <button type="button" className="button secondary" onClick={() => setDraft(emptyDraft())}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </section>

        <section className="catalog-admin-card">
          <h2>Companies ({companies.length})</h2>
          {companies.length === 0 ? (
            <p className="catalog-admin-card-copy">No B2B clients yet. Create Ananda Spa (slug: ananda-spa) to match your bookmark.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {companies.map((company) => (
                <article
                  key={company.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    borderTop: "1px solid rgba(0,0,0,0.08)",
                    paddingTop: 12,
                  }}
                >
                  <div>
                    <strong>{company.name}</strong>
                    <div className="catalog-admin-card-copy">
                      /b2b/{company.slug} · {company.userEmail} · {company.commerceMode} · {company.status} ·{" "}
                      {company.assortment.length} SKUs
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link className="button secondary" href={`/b2b/${company.slug}`} target="_blank">
                      Open
                    </Link>
                    <button type="button" className="button secondary" onClick={() => openCompany(company)}>
                      Edit
                    </button>
                    <button type="button" className="button secondary" onClick={() => void remove(company)}>
                      Delete
                    </button>
                  </div>
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
            <div style={{ display: "grid", gap: 10 }}>
              {quotes.map((q) => (
                <div key={q.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                  <strong>
                    {q.companyName} — ₹{q.subtotalInr.toFixed(2)}
                  </strong>
                  <div className="catalog-admin-card-copy">
                    {new Date(q.createdAt).toLocaleString("en-IN")} · {q.userEmail} · {q.lines.length} lines
                    {q.message ? ` · ${q.message}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
