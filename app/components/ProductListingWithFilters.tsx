"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { formatInrPrice, parseInrPriceNumber } from "../../lib/format-price";
import {
  buildFacetGroups,
  countForFacetValue,
  filterProductsByFacetSelections,
  type FacetGroup
} from "../../lib/product-facets";
import {
  buildPerfumeGenderNav,
  perfumeSelectionLabel,
  productMatchesPerfumeNavSelection,
  type PerfumeGender,
  type PerfumeNavSelection,
} from "../../lib/perfume-shop-nav";
import { getDisplayImageUrl } from "../../lib/product-image";
import type { ProductRecord } from "../../lib/product-types";
import { useAdminSession } from "../../lib/use-admin-session";

type Props = {
  products: ProductRecord[];
  categorySlug?: string;
};

const cloneSelection = (selected: Record<string, string[]>): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [k, arr] of Object.entries(selected)) {
    if (arr.length) {
      out[k] = [...arr];
    }
  }
  return out;
};

const selectionChipEntries = (selected: Record<string, string[]>): { facetId: string; value: string }[] => {
  const chips: { facetId: string; value: string }[] = [];
  for (const [facetId, values] of Object.entries(selected)) {
    for (const value of values) {
      chips.push({ facetId, value });
    }
  }
  return chips;
};

const parsePriceFilterInput = (raw: string): number | null => {
  const t = raw.trim().replace(/,/g, "");
  if (!t) {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const productPassesPriceBounds = (
  product: ProductRecord,
  bounds: { min: number | null; max: number | null }
): boolean => {
  const n = parseInrPriceNumber(product.price);
  if (n === null) {
    return true;
  }
  if (bounds.min !== null && n < bounds.min) {
    return false;
  }
  if (bounds.max !== null && n > bounds.max) {
    return false;
  }
  return true;
};

type GiftPriceBand = "any" | "under-1000" | "1000-2500" | "2500-5000" | "above-5000";

const giftingAudienceOptions = [
  { value: "any", label: "Anyone" },
  { value: "him", label: "For him" },
  { value: "her", label: "For her" },
  { value: "couple", label: "For couples" },
  { value: "family", label: "For family" }
] as const;

const giftingEventOptions = [
  { value: "any", label: "Any occasion" },
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "wedding", label: "Wedding / bridal" },
  { value: "festival", label: "Festival gifting" },
  { value: "corporate", label: "Corporate gifting" }
] as const;

const giftingAudienceTokens: Record<string, string[]> = {
  him: ["him", "men", "male", "man", "grooming"],
  her: ["her", "women", "female", "woman", "beauty"],
  couple: ["couple", "duo", "pair", "partners"],
  family: ["family", "kids", "home", "household"]
};

const giftingEventTokens: Record<string, string[]> = {
  birthday: ["birthday", "celebration", "party"],
  anniversary: ["anniversary", "romance", "love"],
  wedding: ["wedding", "bridal", "bride", "groom", "engagement"],
  festival: ["festival", "diwali", "christmas", "holi", "seasonal"],
  corporate: ["corporate", "office", "team", "client", "business"]
};

const containsAnyToken = (product: ProductRecord, tokens: string[]): boolean => {
  const searchBase = [
    product.name,
    product.description,
    product.shortDescription,
    ...product.tags,
    ...product.categories,
    ...Object.keys(product.attributes),
    ...Object.values(product.attributes).flat()
  ]
    .join(" ")
    .toLowerCase();
  return tokens.some((token) => searchBase.includes(token));
};

const matchesGiftPriceBand = (product: ProductRecord, band: GiftPriceBand): boolean => {
  if (band === "any") {
    return true;
  }
  const n = parseInrPriceNumber(product.price);
  if (n === null) {
    return false;
  }
  if (band === "under-1000") {
    return n < 1000;
  }
  if (band === "1000-2500") {
    return n >= 1000 && n <= 2500;
  }
  if (band === "2500-5000") {
    return n > 2500 && n <= 5000;
  }
  return n > 5000;
};

export function ProductListingWithFilters({ products, categorySlug }: Props) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const [giftFor, setGiftFor] = useState<(typeof giftingAudienceOptions)[number]["value"]>("any");
  const [giftEvent, setGiftEvent] = useState<(typeof giftingEventOptions)[number]["value"]>("any");
  const [giftPriceBand, setGiftPriceBand] = useState<GiftPriceBand>("any");
  const [perfumeNavSelection, setPerfumeNavSelection] = useState<PerfumeNavSelection>({
    gender: null,
    typeKey: null,
    lineKey: null,
  });
  const { adminModeEnabled: isAdmin } = useAdminSession();

  const showPerfumeGenderNav = categorySlug === "perfumes";
  const perfumeGenderNav = useMemo(
    () => (showPerfumeGenderNav ? buildPerfumeGenderNav(products) : []),
    [products, showPerfumeGenderNav]
  );

  const handleSlotUpload = async (productId: string, slot: string, file: File) => {
    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("slot", slot);
    formData.append("image", file);

    try {
      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed to upload image");
    }
  };

  const showGiftingSelector = categorySlug === "gifting";

  const giftingFilteredProducts = useMemo(() => {
    if (!showGiftingSelector) {
      return products;
    }
    return products.filter((product) => {
      const audiencePass =
        giftFor === "any" ? true : containsAnyToken(product, giftingAudienceTokens[giftFor] ?? []);
      const eventPass =
        giftEvent === "any" ? true : containsAnyToken(product, giftingEventTokens[giftEvent] ?? []);
      const bandPass = matchesGiftPriceBand(product, giftPriceBand);
      return audiencePass && eventPass && bandPass;
    });
  }, [giftEvent, giftFor, giftPriceBand, products, showGiftingSelector]);

  const perfumeNavFilteredProducts = useMemo(() => {
    if (!showPerfumeGenderNav || !perfumeNavSelection.gender) {
      return giftingFilteredProducts;
    }
    return giftingFilteredProducts.filter((product) =>
      productMatchesPerfumeNavSelection(product, perfumeNavSelection, perfumeGenderNav)
    );
  }, [giftingFilteredProducts, perfumeGenderNav, perfumeNavSelection, showPerfumeGenderNav]);

  const facetGroups: FacetGroup[] = useMemo(
    () =>
      buildFacetGroups(perfumeNavFilteredProducts).filter(
        (group) => group.id.toLowerCase() !== "size" && group.label.toLowerCase() !== "size"
      ),
    [perfumeNavFilteredProducts]
  );

  const priceBounds = useMemo(() => {
    let min = parsePriceFilterInput(priceMinInput);
    let max = parsePriceFilterInput(priceMaxInput);
    if (min !== null && max !== null && min > max) {
      const swap = min;
      min = max;
      max = swap;
    }
    return { min, max };
  }, [priceMinInput, priceMaxInput]);

  const priceFilterActive = priceBounds.min !== null || priceBounds.max !== null;

  const productsInPriceRange = useMemo(
    () => perfumeNavFilteredProducts.filter((p) => productPassesPriceBounds(p, priceBounds)),
    [perfumeNavFilteredProducts, priceBounds]
  );

  const filtered = useMemo(
    () => filterProductsByFacetSelections(productsInPriceRange, selected),
    [productsInPriceRange, selected]
  );

  const optionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of facetGroups) {
      for (const opt of group.values) {
        const key = `${group.id}::${opt.value}`;
        map.set(key, countForFacetValue(productsInPriceRange, group.id, opt.value, selected));
      }
    }
    return map;
  }, [productsInPriceRange, facetGroups, selected]);

  const hasFacetFilters = useMemo(
    () => Object.values(selected).some((arr) => arr.length > 0),
    [selected]
  );

  const hasPerfumeNavFilter = Boolean(perfumeNavSelection.gender);

  const hasActiveFilters = hasFacetFilters || priceFilterActive || hasPerfumeNavFilter;

  const pricedProductCount = useMemo(
    () => perfumeNavFilteredProducts.filter((p) => parseInrPriceNumber(p.price) !== null).length,
    [perfumeNavFilteredProducts]
  );

  const selectPerfumeGender = useCallback((gender: PerfumeGender) => {
    setPerfumeNavSelection((prev) =>
      prev.gender === gender && !prev.typeKey && !prev.lineKey
        ? { gender: null, typeKey: null, lineKey: null }
        : { gender, typeKey: null, lineKey: null }
    );
  }, []);

  const selectPerfumeLine = useCallback((gender: PerfumeGender, typeKey: string, lineKey: string) => {
    setPerfumeNavSelection((prev) => {
      if (prev.gender === gender && prev.lineKey === lineKey) {
        return { gender, typeKey: null, lineKey: null };
      }
      return { gender, typeKey, lineKey };
    });
  }, []);

  const toggleValue = useCallback((facetId: string, value: string) => {
    setSelected((prev) => {
      const next = cloneSelection(prev);
      const cur = next[facetId] ?? [];
      const has = cur.includes(value);
      next[facetId] = has ? cur.filter((v) => v !== value) : [...cur, value];
      if (next[facetId].length === 0) {
        delete next[facetId];
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelected({});
    setPriceMinInput("");
    setPriceMaxInput("");
    setGiftFor("any");
    setGiftEvent("any");
    setGiftPriceBand("any");
    setPerfumeNavSelection({ gender: null, typeKey: null, lineKey: null });
  }, []);

  const removeChip = useCallback((facetId: string, value: string) => {
    setSelected((prev) => {
      const next = cloneSelection(prev);
      const cur = next[facetId] ?? [];
      next[facetId] = cur.filter((v) => v !== value);
      if (next[facetId].length === 0) {
        delete next[facetId];
      }
      return next;
    });
  }, []);

  const perfumeNavChipLabel = useMemo(
    () => perfumeSelectionLabel(perfumeNavSelection, perfumeGenderNav),
    [perfumeGenderNav, perfumeNavSelection]
  );

  const chips = useMemo(() => selectionChipEntries(selected), [selected]);

  const showFilterAside = giftingFilteredProducts.length > 0 || products.length > 0;

  return (
    <div className="product-listing-layout">
      {showFilterAside ? (
        <aside className="product-filters-aside" aria-label="Product filters">
          {showGiftingSelector ? (
            <section className="gifting-selector" aria-label="Gifting selector">
              <p className="gifting-selector-title">Gifting selector</p>
              <p className="gifting-selector-subtitle">Find the right gift set in seconds</p>
              <label>
                Who&apos;s it for?
                <select value={giftFor} onChange={(event) => setGiftFor(event.target.value as typeof giftFor)}>
                  {giftingAudienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                What&apos;s the event?
                <select value={giftEvent} onChange={(event) => setGiftEvent(event.target.value as typeof giftEvent)}>
                  {giftingEventOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Price range
                <select
                  value={giftPriceBand}
                  onChange={(event) => setGiftPriceBand(event.target.value as GiftPriceBand)}
                >
                  <option value="any">Any budget</option>
                  <option value="under-1000">Under Rs. 1,000</option>
                  <option value="1000-2500">Rs. 1,000 - Rs. 2,500</option>
                  <option value="2500-5000">Rs. 2,500 - Rs. 5,000</option>
                  <option value="above-5000">Above Rs. 5,000</option>
                </select>
              </label>
              <div className="gifting-builder-links">
                <Link href="/gifting/build-your-set" className="gifting-builder-cta maroma-btn maroma-btn-primary">
                  Build your own gift set
                </Link>
                <Link
                  href="/gifting/build-your-set?corporate=1"
                  className="gifting-corporate-link"
                >
                  Corporate gifting
                </Link>
              </div>
            </section>
          ) : null}
          {showPerfumeGenderNav && perfumeGenderNav.length > 0 ? (
            <section className="perfume-gender-nav" aria-label="Shop perfumes by category">
              <p className="perfume-gender-nav-title">Shop by</p>
              <div className="perfume-gender-nav-tabs" role="tablist" aria-label="Perfume gender">
                {perfumeGenderNav.map((section) => (
                  <button
                    key={section.gender}
                    type="button"
                    role="tab"
                    aria-selected={perfumeNavSelection.gender === section.gender}
                    className={`perfume-gender-tab${perfumeNavSelection.gender === section.gender ? " is-active" : ""}`}
                    onClick={() => selectPerfumeGender(section.gender)}
                  >
                    {section.label}
                    <span className="perfume-gender-tab-count">{section.productCount}</span>
                  </button>
                ))}
              </div>
              {perfumeGenderNav.map((section) => (
                <details
                  key={section.gender}
                  className={`perfume-gender-group${perfumeNavSelection.gender === section.gender ? " is-selected" : ""}`}
                  open={perfumeNavSelection.gender === section.gender || perfumeNavSelection.gender === null}
                >
                  <summary className="perfume-gender-group-summary">
                    <span>{section.label}</span>
                    <span className="product-facet-count-badge">{section.productCount}</span>
                  </summary>
                  <div className="perfume-gender-types">
                    {section.types.map((type) => (
                      <div key={type.key} className="perfume-gender-type">
                        <p className="perfume-gender-type-label">{type.type}</p>
                        <ul className="perfume-gender-lines">
                          {type.lines.map((line) => {
                            const active =
                              perfumeNavSelection.gender === section.gender &&
                              perfumeNavSelection.lineKey === line.key;
                            return (
                              <li key={line.key}>
                                <button
                                  type="button"
                                  className={`perfume-gender-line-btn${active ? " is-active" : ""}`}
                                  onClick={() => selectPerfumeLine(section.gender, type.key, line.key)}
                                >
                                  <span>{line.line}</span>
                                  <span className="perfume-gender-line-count">{line.productIds.length}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </section>
          ) : null}
          {hasActiveFilters ? (
            <div className="product-filter-active-bar is-visible">
              <div className="product-filter-active-head">
                <span className="product-filter-active-label">Active filters</span>
                <button type="button" className="product-filter-clear-all" onClick={clearAll}>
                  Clear all
                </button>
              </div>
              <div className="product-filter-chips" role="list">
                {perfumeNavChipLabel ? (
                  <button
                    key="perfume-nav"
                    type="button"
                    className="product-filter-chip"
                    onClick={() =>
                      setPerfumeNavSelection({ gender: null, typeKey: null, lineKey: null })
                    }
                    aria-label={`Remove ${perfumeNavChipLabel}`}
                    role="listitem"
                  >
                    <span className="product-filter-chip-facet">Category</span>
                    <span className="product-filter-chip-sep">·</span>
                    <span>{perfumeNavChipLabel}</span>
                    <span className="product-filter-chip-x" aria-hidden="true">
                      ×
                    </span>
                  </button>
                ) : null}
                {priceBounds.min !== null ? (
                  <button
                    key="price-min"
                    type="button"
                    className="product-filter-chip"
                    onClick={() => setPriceMinInput("")}
                    aria-label={`Remove minimum price ${formatInrPrice(String(priceBounds.min))}`}
                    role="listitem"
                  >
                    <span className="product-filter-chip-facet">Price</span>
                    <span className="product-filter-chip-sep">·</span>
                    <span>Min {formatInrPrice(String(priceBounds.min))}</span>
                    <span className="product-filter-chip-x" aria-hidden="true">
                      ×
                    </span>
                  </button>
                ) : null}
                {priceBounds.max !== null ? (
                  <button
                    key="price-max"
                    type="button"
                    className="product-filter-chip"
                    onClick={() => setPriceMaxInput("")}
                    aria-label={`Remove maximum price ${formatInrPrice(String(priceBounds.max))}`}
                    role="listitem"
                  >
                    <span className="product-filter-chip-facet">Price</span>
                    <span className="product-filter-chip-sep">·</span>
                    <span>Max {formatInrPrice(String(priceBounds.max))}</span>
                    <span className="product-filter-chip-x" aria-hidden="true">
                      ×
                    </span>
                  </button>
                ) : null}
                {chips.map(({ facetId, value }) => (
                  <button
                    key={`${facetId}-${value}`}
                    type="button"
                    className="product-filter-chip"
                    onClick={() => removeChip(facetId, value)}
                    aria-label={`Remove ${facetId}: ${value}`}
                    role="listitem"
                  >
                    <span className="product-filter-chip-facet">{facetId}</span>
                    <span className="product-filter-chip-sep">·</span>
                    <span>{decodeBasicHtmlEntities(value)}</span>
                    <span className="product-filter-chip-x" aria-hidden="true">
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="product-facet-stack">
            {!showGiftingSelector ? (
              <details className="product-facet" open>
                <summary className="product-facet-summary">
                  <span>Price (₹)</span>
                  <span
                    className="product-facet-count-badge"
                    title="Products with a numeric price in the catalog"
                  >
                    {pricedProductCount}
                  </span>
                </summary>
                <div className="product-facet-price-fields">
                  <label>
                    Minimum
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      placeholder="Any"
                      value={priceMinInput}
                      onChange={(e) => setPriceMinInput(e.target.value)}
                      aria-label="Minimum price in rupees"
                    />
                  </label>
                  <label>
                    Maximum
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      placeholder="Any"
                      value={priceMaxInput}
                      onChange={(e) => setPriceMaxInput(e.target.value)}
                      aria-label="Maximum price in rupees"
                    />
                  </label>
                </div>
              </details>
            ) : null}

            {facetGroups.map((group) => (
              <details key={group.id} className="product-facet" open>
                <summary className="product-facet-summary">
                  <span>{decodeBasicHtmlEntities(group.label)}</span>
                  <span
                    className="product-facet-count-badge"
                    title={`${group.popularity} products use this filter`}
                  >
                    {group.popularity}
                  </span>
                </summary>
                <ul className="product-facet-values">
                  {group.values.map((opt) => {
                    const checked = (selected[group.id] ?? []).includes(opt.value);
                    const dynamic = optionCounts.get(`${group.id}::${opt.value}`) ?? 0;
                    const disabled = dynamic === 0 && !checked;
                    return (
                      <li key={opt.value}>
                        <label className={`product-facet-row ${disabled ? "is-disabled" : ""}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleValue(group.id, opt.value)}
                          />
                          <span className="product-facet-row-label">
                            {decodeBasicHtmlEntities(opt.value)}
                          </span>
                          <span className="product-facet-row-count">{dynamic}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        </aside>
      ) : null}

      <div className="product-listing-main">
        <div className="product-grid">
          {filtered.map((product) => {
            const imageSrc = getDisplayImageUrl(product);
            const priceLabel = formatInrPrice(product.price) ?? "Price on request";
            return (
              <div key={product.id} className="product-card-wrap">
                <Link href={`/product/${product.id}`} className="product-card-link">
                  <article className="product-card">
                    <div className="product-card-media">
                      <div className="product-image">
                        {imageSrc ? (
                          <img src={imageSrc} alt={decodeBasicHtmlEntities(product.name)} />
                        ) : (
                          <span>No image</span>
                        )}
                      </div>
                    </div>
                    <div className="product-copy">
                      <h3 className="product-card-title">{decodeBasicHtmlEntities(product.name)}</h3>
                      <p className="product-card-price">{priceLabel}</p>
                      <span className="product-card-cta">Add to Basket</span>
                    </div>
                  </article>
                </Link>
                {isAdmin && (
                  <div className="product-admin-upload-panel">
                    <div className="admin-upload-label">Upload images</div>
                    <div className="admin-upload-slots">
                      {[
                        { id: "main", label: "Main" },
                        { id: "view1", label: "view 1" },
                        { id: "view2", label: "view 2" },
                        { id: "view3", label: "view 3" },
                        { id: "view4", label: "view 4" }
                      ].map((slot) => (
                        <label key={slot.id} className="admin-upload-slot">
                          <span>{slot.label}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleSlotUpload(product.id, slot.id, file);
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="product-listing-empty">
            No products match these filters. Try clearing some attributes or the price range.
          </p>
        ) : null}
      </div>
    </div>
  );
}
