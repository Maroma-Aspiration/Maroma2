"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { decodeBasicHtmlEntities } from "../../../lib/decode-html-entities";
import type { ProductRecord } from "../../../lib/product-types";
import type { QrProductPage } from "../../../lib/qr-product-page-types";
const fresh = (): Partial<QrProductPage> => ({
  status: "draft",
  title: "",
  intro: "",
  slug: "",
  instructions: [],
  safetyNotes: [],
  relatedProductIds: [],
});

type SafetySetOption = { id: string; label: string; languages: string[] };

async function downloadQrLabel(options: {
  destination: string;
  fileName: string;
  caption: string;
  productName: string;
}): Promise<string> {
  const { destination, fileName, caption, productName } = options;
  const qr = await QRCode.toDataURL(destination, {
    width: 900,
    margin: 2,
    color: { dark: "#124f5d", light: "#fffdf8" },
  });
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Could not draw the QR label."));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1260;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not draw the QR label."));
        return;
      }
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, 1080, 1260);
      ctx.drawImage(img, 90, 45, 900, 900);
      ctx.fillStyle = "#124f5d";
      ctx.font = "700 42px Arial";
      ctx.textAlign = "center";
      ctx.fillText(caption, 540, 1035);
      ctx.font = "600 34px Arial";
      const label = productName.length > 48 ? `${productName.slice(0, 45)}…` : productName;
      ctx.fillText(label, 540, 1090);
      ctx.font = "24px Arial";
      ctx.fillStyle = "#49646b";
      ctx.fillText(destination.replace(/^https?:\/\//, ""), 540, 1140);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error("Could not create the QR file."));
          return;
        }
        try {
          const savePicker = (
            window as Window & {
              showSaveFilePicker?: (options: unknown) => Promise<{
                createWritable: () => Promise<{ write: (value: Blob) => Promise<void>; close: () => Promise<void> }>;
              }>;
            }
          ).showSaveFilePicker;
          if (savePicker) {
            const handle = await savePicker({
              suggestedName: fileName,
              types: [{ description: "PNG image", accept: { "image/png": [".png"] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            resolve("QR label saved to your chosen location.");
            return;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            resolve("Save cancelled.");
            return;
          }
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve("QR label downloaded. Enable “ask where to save” in the browser to choose a folder.");
      }, "image/png");
    };
    img.src = qr;
  });
}

export default function QrPagesClient() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [pages, setPages] = useState<QrProductPage[]>([]);
  const [page, setPage] = useState<Partial<QrProductPage>>(fresh());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [safetySets, setSafetySets] = useState<SafetySetOption[]>([]);

  const load = async () => {
    const res = await fetch("/api/admin/qr-product-pages", { cache: "no-store" });
    const data = await res.json();
    setProducts(data.products || []);
    setPages(data.pages || []);
    setSafetySets(data.safetySets || []);
  };
  useEffect(() => {
    void load();
  }, []);

  const product = products.find((item) => item.id === page.productId);
  const filtered = useMemo(
    () => products.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 30),
    [products, query]
  );

  const update = (patch: Partial<QrProductPage>) => setPage((prev) => ({ ...prev, ...patch }));
  const chooseProduct = (item: ProductRecord) =>
    update({
      productId: item.id,
      productName: item.name,
      title: page.title || item.name,
      slug: page.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      imageUrl: page.imageUrl || item.imageUrl,
    });

  const generate = async () => {
    if (!page.productId) return setStatus("Choose a catalog product first.");
    setBusy(true);
    const res = await fetch("/api/admin/qr-product-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", productId: page.productId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setStatus(data.error || "Could not generate instructions.");
    update(data.generated);
    setStatus("Editable instructions generated from the product type.");
  };

  const save = async (publish?: boolean) => {
    if (!page.productId) return setStatus("Choose a catalog product first.");
    setBusy(true);
    const next = { ...page, status: publish ? "published" : page.status || "draft" };
    const res = await fetch("/api/admin/qr-product-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: next }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setStatus(data.error || "Could not save.");
    setPage(data.page);
    setStatus(data.page.status === "published" ? "Published — QR destination is live." : "Draft saved.");
    await load();
  };

  const remove = async (item: QrProductPage) => {
    if (!window.confirm(`Delete the ${item.productName} guide? Its customer page will no longer be available.`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/qr-product-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: item.id }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setStatus(data.error || "Could not delete the guide.");
    if (page.id === item.id) setPage(fresh());
    setStatus("Guide deleted.");
    await load();
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      let url = "";
      if (file.size > 4 * 1024 * 1024 || file.type.startsWith("video/")) {
        const { uploadFileToFirebase } = await import("../../../lib/client-firebase-upload");
        url = await uploadFileToFirebase(file, "qr-product-guides");
      } else {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/admin/qr-product-pages/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
        url = data.url;
      }
      update(file.type.startsWith("video/") ? { videoUrl: url } : { imageUrl: url });
      setStatus("Media uploaded. Save the guide to publish it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const guidePath = page.slug ? `/care/${page.slug}` : "";
  const destination = guidePath ? `${origin}${guidePath}` : "";

  const printSafetyQr = async () => {
    setBusy(true);
    try {
      const message = await downloadQrLabel({
        destination: `${origin}/safety-guidelines`,
        fileName: "maroma-burnable-products-safety-qr.png",
        caption: "SCAN FOR SAFETY GUIDELINES",
        productName: "Incense and candles",
      });
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not download the QR label.");
    } finally {
      setBusy(false);
    }
  };

  const downloadGuideQr = async () => {
    if (!destination || !product) return setStatus("Save the page address and choose its product first.");
    setBusy(true);
    try {
      const message = await downloadQrLabel({
        destination,
        fileName: `maroma-${page.slug}-guide-qr.png`,
        caption: "SCAN FOR PRODUCT GUIDE",
        productName: decodeBasicHtmlEntities(product.name),
      });
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not download the QR label.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="qr-admin-page">
      <header className="qr-admin-header">
        <div>
          <p>Maroma admin</p>
          <h1>Product guides & QR</h1>
          <span>
            Print one safety QR for all incense and candles, or write a product-specific how-to page.
            Scans pick the language from the country they are opened in.
          </span>
        </div>
        <nav>
          <Link href="/safety-guidelines" target="_blank">
            Safety page ↗
          </Link>
          <Link href="/admin/site">Promo</Link>
          <Link href="/admin/products">Products</Link>
          <Link href="/">Home</Link>
        </nav>
      </header>

      <section className="qr-admin-safety-print">
        <p className="qr-admin-kicker">Packaging labels</p>
        <h2>Burnable products safety QR</h2>
        <p>
          Every incense stick, cone and candle uses the same code. It opens the shop safety page. The
          scan country picks the language.
        </p>
        <div className="qr-admin-safety-family">
          <button type="button" disabled={busy} onClick={() => void printSafetyQr()}>
            Download safety QR
          </button>
          <Link href="/safety-guidelines" target="_blank">
            Preview the page
          </Link>
        </div>
      </section>

      <div className="qr-admin-layout">
        <aside className="qr-admin-list">
          <button
            onClick={() => {
              setPage(fresh());
              setStatus("");
            }}
          >
            + New product guide
          </button>
          <h2>Current pages ({pages.length})</h2>
          {pages.length ? (
            pages.map((item) => (
              <div className={`qr-admin-page-item ${page.id === item.id ? "active" : ""}`} key={item.id}>
                <span>{item.status === "published" ? "Live" : "Draft"}</span>
                <strong>{item.productName}</strong>
                <small>/care/{item.slug}</small>
                <div>
                  <button
                    onClick={() => {
                      setPage(item);
                      setStatus("");
                    }}
                  >
                    Edit
                  </button>
                  <button className="delete" disabled={busy} onClick={() => void remove(item)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="qr-admin-empty">No guides created yet.</p>
          )}
        </aside>
        <section className="qr-admin-editor">
          <p
            className={`qr-admin-status ${status.includes("Published") || status.includes("saved") || status.includes("QR") || status.includes("ready") ? "success" : ""}`}
          >
            {status || "Choose a product, generate a starting point, then edit every word."}
          </p>
          <div className="qr-admin-section">
            <h2>1. Choose catalog product</h2>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" />
            {query ? (
              <div className="qr-product-results">
                {filtered.map((item) => (
                  <button key={item.id} onClick={() => chooseProduct(item)}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                    <span>
                      {item.name}
                      <small>{item.sku}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {product ? (
              <p className="qr-selected-product">
                Linked product: <strong>{product.name}</strong>
              </p>
            ) : null}
          </div>
          <div className="qr-admin-section qr-fields">
            <h2>2. Create the guide</h2>
            <button className="qr-generator" disabled={busy} onClick={generate}>
              ✦ Generate editable instructions
            </button>
            <label>
              Page address
              <input value={page.slug || ""} onChange={(e) => update({ slug: e.target.value })} placeholder="your-product-guide" />
            </label>
            <label>
              Guide title
              <input value={page.title || ""} onChange={(e) => update({ title: e.target.value })} />
            </label>
            <label>
              Introduction
              <textarea value={page.intro || ""} onChange={(e) => update({ intro: e.target.value })} />
            </label>
            <label>
              Hero image or video
              <input type="file" accept="image/*,video/*" onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
            {page.imageUrl ? <img className="qr-media-thumb" src={page.imageUrl} alt="Guide media" /> : null}
            {page.videoUrl ? <p>Video uploaded ✓</p> : null}
          </div>
          <div className="qr-admin-section">
            <h2>Instructions</h2>
            {(page.instructions || []).map((item, index) => (
              <div className="qr-instruction-edit" key={item.id}>
                <input
                  value={item.heading}
                  onChange={(e) =>
                    update({
                      instructions: (page.instructions || []).map((x, i) =>
                        i === index ? { ...x, heading: e.target.value } : x
                      ),
                    })
                  }
                  placeholder="Step title"
                />
                <textarea
                  value={item.body}
                  onChange={(e) =>
                    update({
                      instructions: (page.instructions || []).map((x, i) =>
                        i === index ? { ...x, body: e.target.value } : x
                      ),
                    })
                  }
                  placeholder="Instruction"
                />
                <button onClick={() => update({ instructions: (page.instructions || []).filter((_, i) => i !== index) })}>
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                update({
                  instructions: [...(page.instructions || []), { id: `step-${Date.now()}`, heading: "", body: "" }],
                })
              }
            >
              + Add instruction
            </button>
          </div>
          <div className="qr-admin-section">
            <h2>Safety notes</h2>
            <textarea
              value={(page.safetyNotes || []).join("\n")}
              onChange={(e) => update({ safetyNotes: e.target.value.split("\n").filter(Boolean) })}
              placeholder="One safety note per line"
            />
            <label>
              Full safety guidelines
              <select
                value={page.safetySetId || ""}
                onChange={(e) => update({ safetySetId: e.target.value || undefined })}
              >
                <option value="">Match the product automatically</option>
                {safetySets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.label} ({set.languages.length} language{set.languages.length === 1 ? "" : "s"})
                  </option>
                ))}
                <option value="none">No safety guidelines</option>
              </select>
            </label>
            <p className="qr-admin-hint">
              The guide shows the caution paragraph from the chosen set and links to the{" "}
              <Link href="/safety-guidelines" target="_blank">
                full safety guidelines
              </Link>
              . Incense and candle products match automatically.
            </p>
          </div>
          <div className="qr-admin-section">
            <h2>Related products</h2>
            <div className="qr-related-select">
              {products.slice(0, 100).map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={(page.relatedProductIds || []).includes(item.id)}
                    onChange={(e) =>
                      update({
                        relatedProductIds: e.target.checked
                          ? [...(page.relatedProductIds || []), item.id]
                          : (page.relatedProductIds || []).filter((id) => id !== item.id),
                      })
                    }
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </div>
          <div className="qr-admin-actions">
            <button disabled={busy} onClick={() => void save(false)}>
              Save draft
            </button>
            <button disabled={busy} className="publish" onClick={() => void save(true)}>
              Publish guide
            </button>
            <button disabled={busy || !page.slug} onClick={() => void downloadGuideQr()}>
              Download QR label
            </button>
            {page.status === "published" && destination ? (
              <a href={destination} target="_blank">
                Open customer page ↗
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
