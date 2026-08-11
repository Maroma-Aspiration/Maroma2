"use client";

import { useEffect, useMemo, useState } from "react";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { getDisplayImageUrl } from "../../lib/product-image";
import type { ProductRecord } from "../../lib/product-types";
import { SignOutButton } from "../components/SignOutButton";
import {
  contentStorageKey,
  siteContent,
  type CarouselSlide,
  type Highlight,
  type SiteContent
} from "../content";

const emptySlide: CarouselSlide = {
  label: "",
  description: "",
  image: "",
  color: "#f2eee8"
};

const emptyHighlight: Highlight = {
  title: "",
  detail: ""
};

const imageHasTransparency = (image: HTMLImageElement): boolean => {
  const sampleMax = 300;
  const scale = Math.min(1, sampleMax / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return false;
  }
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      return true;
    }
  }
  return false;
};

export default function AdminPage() {
  const [heroPos, setHeroPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [content, setContent] = useState<SiteContent>(siteContent);
  const [status, setStatus] = useState<string>("");
  const [dragEnabled, setDragEnabled] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productStatus, setProductStatus] = useState("Loading product database...");
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [activeSlidePicker, setActiveSlidePicker] = useState<number | null>(null);
  const [slidePickerSearch, setSlidePickerSearch] = useState("");

  useEffect(() => {
    const loadContent = async () => {
      try {
        const response = await fetch("/api/site-content", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as { content?: SiteContent | null };
          if (payload.content) {
            setContent(payload.content);
            try {
              window.localStorage.setItem(contentStorageKey, JSON.stringify(payload.content));
            } catch {
              // ignore
            }
            window.dispatchEvent(new Event("maroma-site-content-changed"));
            return;
          }
        }
      } catch {
        // fall back
      }
      const stored = window.localStorage.getItem(contentStorageKey);
      if (stored) {
        try {
          setContent(JSON.parse(stored) as SiteContent);
        } catch {
          setContent(siteContent);
        }
      }
    };
    void loadContent();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadProducts = async () => {
      try {
        const params = new URLSearchParams();
        if (productSearch.trim()) {
          params.set("q", productSearch.trim());
        }
        const response = await fetch(`/api/products?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error("Failed to load product database");
        }
        const data = (await response.json()) as { products?: ProductRecord[]; count?: number };
        setProducts(data.products ?? []);
        setProductStatus((data.count ?? 0) > 0 ? `${data.count} products found` : "No products found.");
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") {
          return;
        }
        setProductStatus("Unable to load products.");
      }
    };
    void loadProducts();
    return () => controller.abort();
  }, [productSearch]);

  useEffect(() => {
    const stored = window.localStorage.getItem("maroma-admin-drag");
    setDragEnabled(stored === "true");
  }, []);

  useEffect(() => {
    const loadHeroPos = async () => {
      try {
        const response = await fetch("/api/hero-media-layout", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { heroPos?: { x: number; y: number } };
        if (data.heroPos) {
          setHeroPos(data.heroPos);
        }
      } catch {
        setHeroPos({ x: 0, y: 0 });
      }
    };
    void loadHeroPos();
  }, []);

  const phraseValue = useMemo(() => content.hero.phrases.join("\n"), [content]);
  const productsWithImages = useMemo(
    () => products.filter((product) => Boolean(getDisplayImageUrl(product))),
    [products]
  );
  const filteredSlidePickerProducts = useMemo(() => {
    const query = slidePickerSearch.trim().toLowerCase();
    if (!query) {
      return productsWithImages;
    }
    return productsWithImages.filter((product) => {
      const haystack = [
        product.name,
        product.sku,
        product.brand,
        ...product.categories,
        ...product.tags
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [productsWithImages, slidePickerSearch]);

  const saveHeroPos = async (pos: { x: number; y: number }) => {
    setHeroPos(pos);
    try {
      await fetch("/api/hero-media-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroPos: pos })
      });
    } catch {
      // Best-effort persistence.
    }
  };

  const saveContent = async () => {
    try {
      window.localStorage.setItem(contentStorageKey, JSON.stringify(content));
    } catch {
      setStatus(
        "Save failed in this browser (storage quota). Try a smaller hero image or use hosted image URLs."
      );
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2500);
      return;
    }
    try {
      const response = await fetch("/api/site-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!response.ok) {
        throw new Error("Server rejected save");
      }
      window.dispatchEvent(new Event("maroma-site-content-changed"));
      setStatus("Saved to the server. All desktop browsers on this deployment will load this content.");
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setStatus(
        "Saved in this browser only. The server could not store the file (check disk space or request size)."
      );
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2500);
    }
  };
  const toggleDrag = (value: boolean) => {
    setDragEnabled(value);
    window.localStorage.setItem("maroma-admin-drag", value ? "true" : "false");
    window.dispatchEvent(new Event("maroma-admin-changed"));
  };

  const resetContent = async () => {
    window.localStorage.removeItem(contentStorageKey);
    setContent(siteContent);
    try {
      await fetch("/api/site-content", { method: "DELETE" });
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event("maroma-site-content-changed"));
    setStatus("Reset to defaults on this browser and removed server copy (if present).");
  };

  const updateField = (path: string, value: string) => {
    setContent((prev) => {
      const next = structuredClone(prev);
      const keys = path.split(".");
      let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
      while (keys.length > 1) {
        const key = keys.shift();
        if (!key) {
          break;
        }
        cursor = cursor[key] as Record<string, unknown>;
      }
      const lastKey = keys[0];
      if (lastKey) {
        cursor[lastKey] = value;
      }
      return next;
    });
  };

  const updatePhrases = (value: string) => {
    const phrases = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    setContent((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        phrases
      }
    }));
  };

  const updateNav = (value: string) => {
    const nav = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    setContent((prev) => ({
      ...prev,
      nav
    }));
  };

  const updateSlide = (index: number, field: keyof CarouselSlide, value: string) => {
    setContent((prev) => {
      const slides = [...prev.carousel.slides];
      slides[index] = { ...slides[index], [field]: value };
      return {
        ...prev,
        carousel: {
          ...prev.carousel,
          slides
        }
      };
    });
  };

  const updateHighlight = (index: number, field: keyof Highlight, value: string) => {
    setContent((prev) => {
      const highlights = [...prev.highlights];
      highlights[index] = { ...highlights[index], [field]: value };
      return {
        ...prev,
        highlights
      };
    });
  };

  const addSlide = () => {
    setContent((prev) => ({
      ...prev,
      carousel: {
        ...prev.carousel,
        slides: [...prev.carousel.slides, { ...emptySlide }]
      }
    }));
  };

  const removeSlide = (index: number) => {
    setContent((prev) => {
      const slides = prev.carousel.slides.filter((_, idx) => idx !== index);
      return {
        ...prev,
        carousel: {
          ...prev.carousel,
          slides
        }
      };
    });
  };

  const applyProductImageToSlide = (slideIndex: number, productId: string) => {
    const product = productsWithImages.find((entry) => entry.id === productId);
    if (!product) {
      return;
    }
    const imageUrl = getDisplayImageUrl(product);
    if (!imageUrl) {
      return;
    }
    updateSlide(slideIndex, "image", imageUrl);
    if (!content.carousel.slides[slideIndex]?.label.trim()) {
      updateSlide(slideIndex, "label", decodeBasicHtmlEntities(product.name));
    }
    setStatus(`Applied product image from "${decodeBasicHtmlEntities(product.name)}" to slide ${slideIndex + 1}.`);
    setActiveSlidePicker(null);
    setSlidePickerSearch("");
  };

  const addHighlight = () => {
    setContent((prev) => ({
      ...prev,
      highlights: [...prev.highlights, { ...emptyHighlight }]
    }));
  };

  const removeHighlight = (index: number) => {
    setContent((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, idx) => idx !== index)
    }));
  };

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    onValue: (value: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        return;
      }
      const image = new Image();
      image.onload = () => {
        const maxWidth = 1600;
        const maxHeight = 1200;
        const scale = Math.min(
          maxWidth / image.width,
          maxHeight / image.height,
          1
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        onValue(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleHeroMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") {
        return;
      }
      if (file.type.startsWith("video/")) {
        setContent((prev) => ({
          ...prev,
          hero: {
            ...prev.hero,
            video: {
              ...prev.hero.video,
              src: dataUrl
            }
          }
        }));
        setStatus("Uploaded video for hero background. Click Save to persist.");
        return;
      }
      if (file.type.startsWith("image/")) {
        const image = new Image();
        image.onload = () => {
          const hasTransparency = imageHasTransparency(image);
          if (!hasTransparency) {
            setStatus("This image has no transparency (alpha). Please upload a real transparent PNG/WebP.");
          }
          const maxWidth = 1920;
          const maxHeight = 1080;
          const scale = Math.min(
            maxWidth / image.width,
            maxHeight / image.height,
            1
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return;
          }
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const keepAlpha =
            file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
          const compressed = keepAlpha
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", 0.76);
          setContent((prev) => ({
            ...prev,
            hero: {
              ...prev.hero,
              video: {
                ...prev.hero.video,
                poster: compressed,
                src: ""
              }
            }
          }));
          setStatus("Uploaded image for hero background. Click Save to persist.");
        };
        image.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const handleProductImageUpload = async (
    productId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploadingProductId(productId);
    try {
      const formData = new FormData();
      formData.set("productId", productId);
      formData.set("image", file);
      const response = await fetch("/api/products/upload", {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      const data = (await response.json()) as { imageUrl?: string };
      const uploadedUrl = data.imageUrl ?? "";
      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId
            ? { ...product, imageUrl: uploadedUrl, images: uploadedUrl ? [uploadedUrl] : product.images }
            : product
        )
      );
      setStatus("Product image uploaded successfully.");
    } catch {
      setStatus("Product image upload failed.");
    } finally {
      setUploadingProductId(null);
      event.currentTarget.value = "";
    }
  };

  return (
    <div className="admin">
      <nav className="admin-top-nav" aria-label="Admin sections">
        <a href="/">Home</a>
        <a href="/newsletter?edit=1">Newsletter editor</a>
        <a href="/admin/users">Manage Users</a>
        <a href="/admin/products">Products</a>
        <a href="/admin/orders">Production board</a>
        <a href="/blog">Blog</a>
        <a href="/newsletter">Newsletter</a>
        <a href="#brand-nav">Brand + Navigation</a>
        <a href="#hero">Hero</a>
        <a href="#carousel">Carousel</a>
        <a href="#highlights">Highlights</a>
        <a href="#product-database">Product Database</a>
      </nav>

      <header className="admin-header">
        <div>
          <h1>Maroma Admin Editor</h1>
          <p>
            Use Save to write content to the server so every desktop browser loads the same homepage,
            navigation, and carousel data.
          </p>
        </div>
        <div className="admin-actions">
          <SignOutButton />
          <button className="button secondary" type="button" onClick={resetContent}>
            Reset
          </button>
          <button
            className={`button primary ${saveState === "saved" ? "button-success" : ""}`}
            type="button"
            onClick={saveContent}
          >
            {saveState === "saved" ? "Saved!" : "Save"}
          </button>
        </div>
      </header>

      {status ? <div className="admin-status">{status}</div> : null}

      <section className="admin-section" id="brand-nav">
        <h2>Brand + Navigation</h2>
        <label>
          Enable drag mode on homepage
          <input
            type="checkbox"
            checked={dragEnabled}
            onChange={(event) => toggleDrag(event.target.checked)}
          />
        </label>
        <label>
          Brand name
          <input
            type="text"
            value={content.brand}
            onChange={(event) => updateField("brand", event.target.value)}
          />
        </label>
        <label>
          Menu items (comma-separated)
          <input
            type="text"
            value={content.nav.join(", ")}
            onChange={(event) => updateNav(event.target.value)}
          />
        </label>
      </section>

      <section className="admin-section" id="hero">
        <h2>Hero</h2>
        <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "start" }}>
            Hero horizontal position
            <input
              type="range"
              min="-200"
              max="200"
              value={heroPos.x}
              onChange={e => saveHeroPos({ ...heroPos, x: Number(e.target.value) })}
              style={{ width: 180 }}
            />
            <span style={{ fontSize: 12, color: "#888" }}>{heroPos.x}px</span>
          </label>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "start" }}>
            Hero vertical position
            <input
              type="range"
              min="-200"
              max="200"
              value={heroPos.y}
              onChange={e => saveHeroPos({ ...heroPos, y: Number(e.target.value) })}
              style={{ width: 180 }}
            />
            <span style={{ fontSize: 12, color: "#888" }}>{heroPos.y}px</span>
          </label>
        </div>
        <label>
          Eyebrow
          <input
            type="text"
            value={content.hero.eyebrow}
            onChange={(event) => updateField("hero.eyebrow", event.target.value)}
          />
        </label>
        <label>
          Headline
          <input
            type="text"
            value={content.hero.headline}
            onChange={(event) => updateField("hero.headline", event.target.value)}
          />
        </label>
        <label>
          Subhead
          <textarea
            value={content.hero.subhead}
            onChange={(event) => updateField("hero.subhead", event.target.value)}
          />
        </label>
        <label>
          Primary CTA
          <input
            type="text"
            value={content.hero.ctaPrimary}
            onChange={(event) => updateField("hero.ctaPrimary", event.target.value)}
          />
        </label>
        <label>
          Secondary CTA
          <input
            type="text"
            value={content.hero.ctaSecondary}
            onChange={(event) => updateField("hero.ctaSecondary", event.target.value)}
          />
        </label>
        <p style={{ fontSize: "0.85rem", color: "#5c5a57", maxWidth: "42rem", margin: "4px 0 12px" }}>
          CTA placement: on the homepage, turn on Admin mode and drag the button row. When you release,
          the position is saved to the server (same file as hero headline/eyebrow layout) so every desktop
          browser loads it. No extra Save needed for that.
        </p>
        <label>
          Hero phrases (one per line)
          <textarea value={phraseValue} onChange={(event) => updatePhrases(event.target.value)} />
        </label>
        <div className="admin-media">
          <label>
            Upload hero media (image/video)
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleHeroMediaUpload}
            />
          </label>
          <label>
            Hero video URL (MP4 or YouTube)
            <input
              type="text"
              value={content.hero.video.src}
              onChange={(event) => updateField("hero.video.src", event.target.value)}
            />
          </label>
          <label>
            Hero video URL (mobile, optional YouTube)
            <input
              type="text"
              value={content.hero.video.mobileSrc ?? ""}
              onChange={(event) => updateField("hero.video.mobileSrc", event.target.value)}
            />
          </label>
          <label>
            Hero poster URL
            <input
              type="text"
              value={content.hero.video.poster}
              onChange={(event) => updateField("hero.video.poster", event.target.value)}
            />
          </label>
          <label>
            Upload hero poster
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                handleImageUpload(event, (value) => updateField("hero.video.poster", value))
              }
            />
          </label>
        </div>
      </section>

      <section className="admin-section" id="carousel">
        <h2>Carousel</h2>
        <label>
          Title
          <input
            type="text"
            value={content.carousel.title}
            onChange={(event) => updateField("carousel.title", event.target.value)}
          />
        </label>
        <label>
          Subtitle
          <textarea
            value={content.carousel.subtitle}
            onChange={(event) => updateField("carousel.subtitle", event.target.value)}
          />
        </label>

        <div className="admin-grid">
          {content.carousel.slides.map((slide, index) => (
            <div key={`${slide.label}-${index}`} className="admin-card">
              <h3>Slide {index + 1}</h3>
              <label>
                Label
                <input
                  type="text"
                  value={slide.label}
                  onChange={(event) => updateSlide(index, "label", event.target.value)}
                />
              </label>
              <label>
                Description
                <textarea
                  value={slide.description}
                  onChange={(event) => updateSlide(index, "description", event.target.value)}
                />
              </label>
              <label>
                Image URL
                <input
                  type="text"
                  value={slide.image}
                  onChange={(event) => updateSlide(index, "image", event.target.value)}
                />
              </label>
              <label>
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleImageUpload(event, (value) => updateSlide(index, "image", value))
                  }
                />
              </label>
              <div className="admin-slide-picker-trigger-row">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setActiveSlidePicker((prev) => (prev === index ? null : index));
                    setSlidePickerSearch("");
                  }}
                >
                  {activeSlidePicker === index ? "Close image viewer" : "Open image viewer"}
                </button>
              </div>
              {activeSlidePicker === index ? (
                <div className="admin-product-picker-viewer">
                  <label>
                    Search product images
                    <input
                      type="search"
                      value={slidePickerSearch}
                      onChange={(event) => setSlidePickerSearch(event.target.value)}
                      placeholder="Search product name, SKU, category..."
                    />
                  </label>
                  <div className="admin-product-picker-inline">
                    {filteredSlidePickerProducts.map((product) => {
                      const imageSrc = getDisplayImageUrl(product);
                      return (
                        <button
                          key={`${index}-${product.id}`}
                          type="button"
                          className="admin-product-picker-item"
                          onClick={() => applyProductImageToSlide(index, product.id)}
                          title={`Use ${decodeBasicHtmlEntities(product.name)}`}
                        >
                          <img src={imageSrc} alt="" aria-hidden />
                          <span>{decodeBasicHtmlEntities(product.name)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {filteredSlidePickerProducts.length === 0 ? (
                    <p className="admin-product-picker-empty">No product images match this search.</p>
                  ) : null}
                </div>
              ) : null}
              <label>
                Background color
                <input
                  type="color"
                  value={slide.color}
                  onChange={(event) => updateSlide(index, "color", event.target.value)}
                />
              </label>
              <button
                className="button secondary"
                type="button"
                onClick={() => removeSlide(index)}
              >
                Remove slide
              </button>
            </div>
          ))}
        </div>
        <button className="button secondary" type="button" onClick={addSlide}>
          Add slide
        </button>
      </section>

      <section className="admin-section" id="highlights">
        <h2>Highlights</h2>
        <div className="admin-grid">
          {content.highlights.map((highlight, index) => (
            <div key={`${highlight.title}-${index}`} className="admin-card">
              <h3>Highlight {index + 1}</h3>
              <label>
                Title
                <input
                  type="text"
                  value={highlight.title}
                  onChange={(event) => updateHighlight(index, "title", event.target.value)}
                />
              </label>
              <label>
                Detail
                <textarea
                  value={highlight.detail}
                  onChange={(event) => updateHighlight(index, "detail", event.target.value)}
                />
              </label>
              <button
                className="button secondary"
                type="button"
                onClick={() => removeHighlight(index)}
              >
                Remove highlight
              </button>
            </div>
          ))}
        </div>
        <button className="button secondary" type="button" onClick={addHighlight}>
          Add highlight
        </button>
      </section>

      <section className="admin-section" id="product-database">
        <h2>Product Database</h2>
        <p>Search the catalog and upload a product image to update customer-facing cards.</p>
        <label>
          Search by name, SKU, category, or ingredient
          <input
            type="search"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Lavender, soap, ML16..."
          />
        </label>
        <div className="product-admin-status">{productStatus}</div>
        <div className="admin-grid">
          {products.map((product) => {
            const imageSrc = getDisplayImageUrl(product);
            return (
              <div key={product.id} className="admin-card">
                <h3>{decodeBasicHtmlEntities(product.name)}</h3>
                <p><strong>SKU:</strong> {product.sku || "None"}</p>
                <p><strong>Price:</strong> {product.price ? `Rs. ${product.price}` : "Not set"}</p>
                <div className="admin-product-preview">
                  {imageSrc ? (
                    <img src={imageSrc} alt={decodeBasicHtmlEntities(product.name)} />
                  ) : (
                    <span>No image uploaded</span>
                  )}
                </div>
                <label>
                  Upload product image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleProductImageUpload(product.id, event)}
                    disabled={uploadingProductId === product.id}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
