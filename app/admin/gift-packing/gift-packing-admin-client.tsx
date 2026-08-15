"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GiftPackingStore } from "../../../lib/gift-packing-store";
import type { GiftBuilderCatalog, GiftSizeGroup } from "../../../lib/gift-builder-types";
import type { AdminProductSummary } from "../../../lib/product-catalog-admin";

const numberValue = (value: string) => Math.max(0.5, Number(value) || 0.5);

export default function GiftPackingAdminClient() {
  const [packing, setPacking] = useState<GiftPackingStore | null>(null);
  const [catalog, setCatalog] = useState<GiftBuilderCatalog | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminProductSummary[]>([]);
  const [chosenIds, setChosenIds] = useState<string[]>([]);
  const [category, setCategory] = useState<"scent" | "soap" | "candle" | "wellness" | "accent">("accent");
  const [sizeGroup, setSizeGroup] = useState<GiftSizeGroup>("small");
  const [dimensions, setDimensions] = useState({ lengthCm: 5, widthCm: 5, heightCm: 5 });

  useEffect(() => { void Promise.all([
    fetch("/api/admin/gift-packing", { cache: "no-store" }).then((r) => r.json()),
    fetch("/api/gift-builder/catalog", { cache: "no-store" }).then((r) => r.json()),
  ]).then(([saved, live]) => { setPacking(saved); setCatalog(live); }); }, []);

  const save = async () => {
    if (!packing) return;
    setSaving(true); setStatus("");
    const res = await fetch("/api/admin/gift-packing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(packing) });
    const data = await res.json();
    if (res.ok) { setPacking(data); setStatus("Gift packing saved!"); } else setStatus(data.error || "Could not save.");
    setSaving(false);
  };

  const upload = async (boxId: string, file: File) => {
    setUploading(boxId);
    const form = new FormData(); form.set("file", file);
    const res = await fetch("/api/upload-canvas-image", { method: "POST", body: form });
    const data = await res.json();
    if (res.ok && data.url) setPacking((current) => current ? ({ ...current, boxes: current.boxes.map((box) => box.id === boxId ? { ...box, topImage: data.url } : box) }) : current);
    setUploading("");
  };

  const searchProducts = async () => {
    const params = new URLSearchParams({ q: query, limit: "25", status: "all" });
    const data = await fetch(`/api/admin/products?${params}`, { cache: "no-store" }).then((res) => res.json());
    setResults(data.products ?? []);
    setChosenIds([]);
  };

  const addGiftProduct = () => {
    if (!packing || !catalog) return;
    if (chosenIds.length === 0) { setStatus("Choose at least one product first."); return; }
    const existing = new Set([...packing.customProducts.map((item) => item.productId), ...catalog.elements.map((item) => item.productId)]);
    const addable = chosenIds.filter((id) => !existing.has(id));
    const skipped = chosenIds.length - addable.length;
    if (addable.length === 0) { setStatus("All selected products are already in the gift builder."); return; }
    const customProducts = addable.map((productId) => ({ id: `gift-${productId}`, productId, description: "A Maroma product selected for your custom gift.", category }));
    const elementDimensions = Object.fromEntries(addable.map((productId) => [`gift-${productId}`, { ...dimensions, sizeGroup }]));
    setPacking({ ...packing, customProducts: [...packing.customProducts, ...customProducts], elementDimensions: { ...packing.elementDimensions, ...elementDimensions } });
    setAdding(false); setChosenIds([]); setResults([]); setQuery(""); setStatus(`${addable.length} gift product${addable.length === 1 ? "" : "s"} added${skipped ? `; ${skipped} duplicate${skipped === 1 ? " was" : "s were"} skipped` : ""}. Press Save to publish.`);
  };

  if (!packing || !catalog) return <main className="catalog-admin-page"><p className="catalog-admin-empty">Loading gift packing…</p></main>;
  return <main className="catalog-admin-page"><div className="catalog-admin-shell catalog-admin-shell--edit">
    <header className="catalog-admin-header"><div><Link href="/admin" className="catalog-admin-back">← Admin</Link><h1>Gift packing</h1><p className="catalog-admin-lede">Set the usable inside dimensions. Measure wrapped products and allow a little clearance.</p></div><div className="catalog-admin-header-actions"><Link href="/gifting/build-your-set" className="button secondary">View builder</Link><button className={`button primary button-sage${status.includes("saved") ? " process-success" : ""}`} onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : status.includes("saved") ? "Gift packing saved!" : "Save"}</button></div></header>
    {status ? <p className="catalog-admin-status catalog-admin-status--ok">{status}</p> : null}
    <section className="catalog-admin-card"><h2>Gift boxes</h2><p className="catalog-admin-card-copy">Dimensions are the usable space inside the box. The image should be photographed directly from above.</p><div className="gift-packing-admin-boxes">{packing.boxes.map((box) => <article key={box.id} className="gift-packing-admin-box"><div className="gift-packing-admin-image">{box.topImage || box.image ? <img src={box.topImage || box.image} alt="" /> : <span>No image</span>}</div><div><h3>{box.name}</h3><div className="gift-packing-dimension-grid">{(["lengthCm", "widthCm", "heightCm"] as const).map((field) => <label className="catalog-admin-field" key={field}><span>{field === "lengthCm" ? "Length" : field === "widthCm" ? "Width" : "Height"} (cm)</span><input type="number" min="0.5" step="0.5" value={box[field]} onChange={(e) => setPacking({ ...packing, boxes: packing.boxes.map((entry) => entry.id === box.id ? { ...entry, [field]: numberValue(e.target.value) } : entry) })} /></label>)}</div><label className="button secondary catalog-admin-upload-btn">{uploading === box.id ? "Uploading…" : "Upload top view"}<input hidden type="file" accept="image/*" disabled={Boolean(uploading)} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(box.id, file); }} /></label></div></article>)}</div></section>
    <section className="catalog-admin-card"><div className="gift-packing-section-head"><div><h2>Gift product dimensions</h2><p className="catalog-admin-card-copy">These are the packed dimensions, including tissue or protective wrapping.</p></div><button type="button" className="button primary button-sage" onClick={() => setAdding((value) => !value)}>{adding ? "Cancel" : "Add Gift Product"}</button></div>
    {adding ? <div className="gift-packing-add-product"><div className="catalog-admin-search"><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search catalogue by product or SKU" onKeyDown={(e) => { if (e.key === "Enter") void searchProducts(); }} /><button type="button" className="button secondary" onClick={() => void searchProducts()}>Search</button></div>{results.length ? <div className="gift-packing-result-picker"><div className="gift-packing-result-actions"><strong>{chosenIds.length} selected</strong><button type="button" onClick={() => setChosenIds(results.map((product) => product.id))}>Select all</button><button type="button" onClick={() => setChosenIds([])}>Clear</button></div>{results.map((product) => <label key={product.id}><input type="checkbox" checked={chosenIds.includes(product.id)} onChange={(e) => setChosenIds((current) => e.target.checked ? [...current, product.id] : current.filter((id) => id !== product.id))} />{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="gift-packing-result-placeholder" />}<span><strong>{product.name}</strong><small>{product.sku}</small></span></label>)}</div> : null}<label className="catalog-admin-field"><span>Gift category</span><select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}><option value="scent">Scent</option><option value="soap">Soap</option><option value="candle">Candle</option><option value="wellness">Wellness</option><option value="accent">Accent</option></select></label><label className="catalog-admin-field"><span>Size</span><select value={sizeGroup} onChange={(e) => setSizeGroup(e.target.value as GiftSizeGroup)}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>{(["lengthCm", "widthCm", "heightCm"] as const).map((field) => <label className="catalog-admin-field" key={field}><span>{field === "lengthCm" ? "Length" : field === "widthCm" ? "Width" : "Height"} (cm)</span><input type="number" min="0.5" step="0.5" value={dimensions[field]} onChange={(e) => setDimensions({ ...dimensions, [field]: numberValue(e.target.value) })} /></label>)}<button type="button" className="button primary button-sage" onClick={addGiftProduct}>Add {chosenIds.length || "selected"} to gift builder</button></div> : null}
    <div className="gift-packing-admin-products">{catalog.elements.map((element) => { const dims = packing.elementDimensions[element.id]; return <article key={element.id} className="gift-packing-product-row"><img src={element.image} alt="" /><strong>{element.name}</strong><label className="catalog-admin-field"><span>Size</span><select value={dims.sizeGroup} onChange={(e) => setPacking({ ...packing, elementDimensions: { ...packing.elementDimensions, [element.id]: { ...dims, sizeGroup: e.target.value as GiftSizeGroup } } })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>{(["lengthCm", "widthCm", "heightCm"] as const).map((field) => <label className="catalog-admin-field" key={field}><span>{field.slice(0, 1).toUpperCase()} (cm)</span><input type="number" min="0.5" step="0.5" value={dims[field]} onChange={(e) => setPacking({ ...packing, elementDimensions: { ...packing.elementDimensions, [element.id]: { ...dims, [field]: numberValue(e.target.value) } } })} /></label>)}</article>; })}</div></section>
  </div></main>;
}
