"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { decodeBasicHtmlEntities } from "../../lib/decode-html-entities";
import { parseInrPriceNumber } from "../../lib/format-price";
import { useCurrency } from "../../context/CurrencyContext";
import {
  buildFacetGroups,
  countForFacetValue,
  filterProductsByFacetSelections,
  type FacetGroup
} from "../../lib/product-facets";
import {
  buildPerfumeGenderNav,
  getPerfumeGender,
  perfumeSelectionLabel,
  productMatchesPerfumeNavSelection,
  type PerfumeGender,
  type PerfumeNavSelection,
} from "../../lib/perfume-shop-nav";
import { getDisplayImageUrl } from "../../lib/product-image";
import { productImageTransform } from "../../lib/product-image-focus";
import { isGift3dPreviewProduct } from "../../lib/gift-builder-catalog";
import { isGiftingProduct } from "../../lib/product-gifting";
import { productPriceState } from "../../lib/product-pricing";
import type { ProductRecord } from "../../lib/product-types";
import { useAdminSession } from "../../lib/use-admin-session";

type Props = {
  products: ProductRecord[];
  categorySlug?: string;
  searchQuery?: string;
};

type ShopType = { id: string; label: string; tokens: string[] };
type ProductSort = "featured" | "price-low" | "price-high" | "newest";

const SHOP_TYPES: Record<string, ShopType[]> = {
  "face-care": [
    { id: "cleanser", label: "Cleansers", tokens: ["cleanser", "face wash", "cleansing"] },
    { id: "cream", label: "Creams", tokens: ["face cream", "day cream", "night cream", "moistur"] },
    { id: "serum", label: "Serums", tokens: ["serum"] },
    { id: "scrub-mask", label: "Scrubs & Masks", tokens: ["face scrub", "facial scrub", "mask", "pack"] },
    { id: "mist", label: "Mists & Toners", tokens: ["mist", "toner", "rose water"] },
    { id: "lip-eye", label: "Lip & Eye Care", tokens: ["lip", "under eye", "eye cream"] },
  ],
  "body-care": [
    { id: "colibri", label: "Colibri", tokens: ["colibri"] },
    { id: "lotion", label: "Lotions", tokens: ["lotion", "body milk"] },
    { id: "gel", label: "Shower Gels", tokens: ["shower gel", "body wash"] },
    { id: "soap", label: "Soaps", tokens: ["soap"] },
    { id: "deodorant", label: "Deodorants", tokens: ["deodorant", "body spray"] },
    { id: "butter", label: "Body Butters", tokens: ["body butter"] },
    { id: "oil", label: "Body Oils", tokens: ["body oil", "massage oil"] },
    { id: "bath", label: "Bath & Scrub", tokens: ["bath salt", "foot soak", "body scrub"] },
  ],
  "hair-care": [
    { id: "shampoo", label: "Shampoo", tokens: ["shampoo"] },
    { id: "conditioner", label: "Conditioner", tokens: ["conditioner"] },
    { id: "hair-oil", label: "Hair Oil", tokens: ["hair oil"] },
    { id: "hair-care", label: "Treatments", tokens: ["hair mask", "hair serum", "scalp", "hair mist"] },
  ],
  baby: [
    { id: "baby-bath", label: "Bath Time", tokens: ["baby shampoo", "baby wash", "baby soap", "bubble bath"] },
    { id: "baby-skin", label: "Skin Care", tokens: ["baby lotion", "baby cream", "baby oil"] },
    { id: "baby-powder", label: "Powder", tokens: ["baby powder", "talcom"] },
    { id: "baby-gift", label: "Gift Sets", tokens: ["gift", "set", "kit"] },
  ],
  man: [
    { id: "shave", label: "Shaving", tokens: ["shave", "shaving"] },
    { id: "beard", label: "Beard Care", tokens: ["beard"] },
    { id: "man-bath", label: "Bath & Body", tokens: ["soap", "shower gel", "body wash"] },
    { id: "man-hair", label: "Hair Care", tokens: ["shampoo", "conditioner", "hair"] },
    { id: "man-fragrance", label: "Fragrance", tokens: ["perfume", "eau de", "fragrance", "roll on"] },
    { id: "man-sets", label: "Sets", tokens: ["set", "kit", "pack"] },
  ],
  perfumes: [
    { id: "eau-de-toilette", label: "Eau de Toilette", tokens: ["eau de toilette"] },
    { id: "solid-perfume", label: "Solid Perfume", tokens: ["solid perfume"] },
    { id: "roll-on", label: "Roll-On", tokens: ["roll on", "roll-on"] },
    { id: "mist-perfume", label: "Mists", tokens: ["mist"] },
    { id: "perfume-sets", label: "Perfume Sets", tokens: ["set", "collection"] },
  ],
  "home-essentials": [
    { id: "colibri", label: "Colibri", tokens: ["colibri"] },
    { id: "incense", label: "Incense", tokens: ["incense", "smudge"] },
    { id: "candles", label: "Candles", tokens: ["candle", "votive"] },
    { id: "diffusers", label: "Diffusers", tokens: ["diffuser", "perfume mat"] },
    { id: "sachets", label: "Sachets", tokens: ["sachet"] },
    { id: "home-care", label: "Everyday Care", tokens: ["dish wash", "hand wash"] },
  ],
  colibri: [
    { id: "colibri-incense", label: "Incense", tokens: ["incense", "leaf", "leaves", "cone"] },
    { id: "colibri-body", label: "Body Protection", tokens: ["body spray", "roll-on", "roll on"] },
    { id: "colibri-candle", label: "Candles", tokens: ["candle", "votive"] },
    { id: "colibri-set", label: "Sets", tokens: ["set", "kit"] },
  ],
  gifting: [
    { id: "gift-women", label: "Women", tokens: ["women", "woman", "her", "female", "face care", "skin care"] },
    { id: "gift-men", label: "Men", tokens: ["man", "men", "him", "male", "shave", "beard"] },
    { id: "gift-corporate", label: "Corporate", tokens: ["corporate", "office", "business", "client", "team", "employee"] },
    { id: "gift-skincare", label: "Skin & Body Sets", tokens: ["skin", "body", "wellness", "nurture", "soap gift"] },
    { id: "gift-fragrance", label: "Fragrance Sets", tokens: ["perfume", "fragrance", "eau de"] },
    { id: "gift-home", label: "Home Fragrance", tokens: ["incense", "candle", "votive", "diffuser", "home fragrance"] },
    { id: "gift-baby", label: "Baby Gifts", tokens: ["baby"] },
    { id: "gift-festive", label: "Festive Gifts", tokens: ["festive", "diwali", "christmas", "valentine"] },
  ],
};

const matchesShopType = (product: ProductRecord, tokens: string[]): boolean => {
  const text = [product.name, ...product.categories, ...product.tags].join(" ").toLowerCase();
  return tokens.some((token) => text.includes(token));
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

export function ProductListingWithFilters({ products, categorySlug, searchQuery = "" }: Props) {
  const { formatMoney, formatCatalogPrice, isEstimated } = useCurrency();
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [shopTypeId, setShopTypeId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ProductSort>("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isGridLoading, setIsGridLoading] = useState(false);
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
  const [ready3dIds, setReady3dIds] = useState<Set<string>>(() => new Set());
  const { adminModeEnabled: isAdmin } = useAdminSession();

  const availableShopTypes = useMemo(() => {
    const configured = SHOP_TYPES[categorySlug ?? ""] ?? [];
    return configured
      .map((type) => ({ ...type, count: products.filter((product) => matchesShopType(product, type.tokens)).length }))
      .filter((type) => type.count > 0 || (categorySlug === "gifting" && ["gift-women", "gift-men", "gift-corporate"].includes(type.id)));
  }, [categorySlug, products]);

  useEffect(() => {
    if (!categorySlug || availableShopTypes.length === 0) return;
    const saved = window.sessionStorage.getItem(`maroma-shop-type:${categorySlug}`);
    if (saved === "all" || (saved && availableShopTypes.some((type) => type.id === saved))) {
      setShopTypeId(saved);
    }
  }, [availableShopTypes, categorySlug]);

  useEffect(() => {
    if (!categorySlug || !shopTypeId) return;
    window.sessionStorage.setItem(`maroma-shop-type:${categorySlug}`, shopTypeId);
  }, [categorySlug, shopTypeId]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/gift-3d-assets", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { assets?: Record<string, { glbUrl?: string }> }) => {
        if (cancelled) return;
        const ids = Object.entries(data.assets ?? {})
          .filter(([, asset]) => Boolean(asset?.glbUrl))
          .map(([id]) => id);
        setReady3dIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setReady3dIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shopTypeProducts = useMemo(() => {
    if (!shopTypeId) return categorySlug ? [] : products;
    if (shopTypeId === "all") return products;
    const type = availableShopTypes.find((entry) => entry.id === shopTypeId);
    return type ? products.filter((product) => matchesShopType(product, type.tokens)) : [];
  }, [availableShopTypes, categorySlug, products, shopTypeId]);

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
      return shopTypeProducts;
    }
    return shopTypeProducts.filter((product) => {
      const audiencePass =
        giftFor === "any" ? true : containsAnyToken(product, giftingAudienceTokens[giftFor] ?? []);
      const eventPass =
        giftEvent === "any" ? true : containsAnyToken(product, giftingEventTokens[giftEvent] ?? []);
      const bandPass = matchesGiftPriceBand(product, giftPriceBand);
      return audiencePass && eventPass && bandPass;
    });
  }, [giftEvent, giftFor, giftPriceBand, shopTypeProducts, showGiftingSelector]);

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

  const sortedProducts = useMemo(() => {
    const result = [...filtered];
    if (sortBy === "price-low" || sortBy === "price-high") {
      const direction = sortBy === "price-low" ? 1 : -1;
      result.sort((a, b) => {
        const aPrice = parseInrPriceNumber(a.price);
        const bPrice = parseInrPriceNumber(b.price);
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return (aPrice - bPrice) * direction;
      });
    } else if (sortBy === "newest") {
      result.sort((a, b) => {
        const aId = Number(a.id);
        const bId = Number(b.id);
        if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
        return b.id.localeCompare(a.id, undefined, { numeric: true });
      });
    }
    return result;
  }, [filtered, sortBy]);

  const revealLoadingState = useCallback(() => {
    setIsGridLoading(true);
    window.setTimeout(() => setIsGridLoading(false), 420);
  }, []);

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

  // Collection pages wait for a product-type choice before showing their
  // detailed filters. The homepage search has no type chooser, so its filters
  // must be available immediately; otherwise the results occupy the narrow
  // first column reserved for the filter panel on desktop.
  const showFilterAside = shopTypeProducts.length > 0 && (!categorySlug || shopTypeId !== null);

  const recommendedProducts = useMemo(() => {
    const picked: ProductRecord[] = [];
    for (const type of availableShopTypes) {
      const product = products.find((entry) =>
        !picked.some((pickedProduct) => pickedProduct.id === entry.id) &&
        matchesShopType(entry, type.tokens) &&
        Boolean(getDisplayImageUrl(entry))
      );
      if (product) picked.push(product);
      if (picked.length === 4) break;
    }
    if (picked.length < 4) {
      for (const product of products) {
        if (getDisplayImageUrl(product) && !picked.some((entry) => entry.id === product.id)) {
          picked.push(product);
        }
        if (picked.length === 4) break;
      }
    }
    return picked;
  }, [availableShopTypes, products]);

  const recommendedSection = recommendedProducts.length > 0 ? (
    <section className="collection-recommended" aria-labelledby="collection-recommended-title">
      <div className="collection-recommended-heading">
        <p>Selected from this collection</p>
        <h2 id="collection-recommended-title">Recommended for you</h2>
      </div>
      <div className="collection-recommended-grid">
        {recommendedProducts.map((product) => {
          const imageSrc = getDisplayImageUrl(product);
          const priceState = productPriceState(product);
          const convertedPrice = formatCatalogPrice(priceState.active);
          const priceLabel = convertedPrice ? `${isEstimated ? "≈ " : ""}${convertedPrice}` : "Price on request";
          return (
            <Link key={product.id} href={`/product/${product.id}`} className="collection-recommended-card">
              <div className="collection-recommended-image">
                {imageSrc ? <img src={imageSrc} alt={`${decodeBasicHtmlEntities(product.name)} — Maroma`} /> : null}
              </div>
              <div className="collection-recommended-copy">
                <h3>{decodeBasicHtmlEntities(product.name)}</h3>
                <p className={priceState.onSale ? "collection-recommended-price is-on-sale" : "collection-recommended-price"}>
                  {priceState.onSale ? <s>{formatCatalogPrice(priceState.regular)}</s> : null}
                  <span>{priceLabel}</span>
                </p>
                <span>View product <span aria-hidden="true">→</span></span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  ) : null;

  return (
    <div className={`product-listing-experience${shopTypeId ? " has-selection" : ""}`}>
      {categorySlug ? <section className="collection-shop-types" aria-label="Shop by product type">
        <div className="collection-shop-types-heading">
          <div>
            <p>Shop by type</p>
            <h2>What are you looking for?</h2>
          </div>
          {shopTypeId ? <span>{shopTypeProducts.length} products</span> : null}
        </div>
        {showPerfumeGenderNav && perfumeGenderNav.length > 0 ? (
          <div className="collection-perfume-gender-row" aria-label="Shop perfume by gender">
            {perfumeGenderNav.map((section) => {
              const representative = products.find(
                (product) => getPerfumeGender(product) === section.gender && Boolean(getDisplayImageUrl(product))
              );
              const image = representative ? getDisplayImageUrl(representative) : "";
              const active = perfumeNavSelection.gender === section.gender;
              return (
                <button
                  key={section.gender}
                  type="button"
                  className={`collection-shop-type-button collection-perfume-gender-button${active ? " is-complete" : ""}`}
                  aria-pressed={active}
                  onClick={() => {
                    if (!shopTypeId) setShopTypeId("all");
                    selectPerfumeGender(section.gender);
                    revealLoadingState();
                  }}
                >
                  <span className="collection-shop-type-photo" aria-hidden="true">
                    {image ? <img src={image} alt="" /> : <span>✦</span>}
                  </span>
                  <span>{section.label}</span>
                  <small>{section.productCount}</small>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="collection-shop-types-row">
          {showGiftingSelector ? (
            <Link href="/gifting/build-your-set" className="collection-gift-builder-magic">
              <span className="collection-gift-builder-sparkles" aria-hidden="true">
                <i>✦</i><i>✧</i><i>✦</i>
              </span>
              <span className="collection-gift-builder-copy">
                <small>Create something magical</small>
                <strong>Build your own gift set</strong>
              </span>
              <span className="collection-gift-builder-arrow" aria-hidden="true">→</span>
            </Link>
          ) : null}
          <button
            type="button"
            className={`collection-shop-type-button collection-browse-all-button${shopTypeId === "all" ? " is-complete" : ""}`}
            aria-pressed={shopTypeId === "all"}
            onClick={() => {
              setShopTypeId("all");
              clearAll();
              revealLoadingState();
            }}
          >
            <span className="collection-shop-type-photo collection-browse-all-icon" aria-hidden="true">✦</span>
            <span>Browse all</span>
            <small>{products.length}</small>
          </button>
          {availableShopTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`collection-shop-type-button${shopTypeId === type.id ? " is-complete" : ""}`}
              aria-pressed={shopTypeId === type.id}
              onClick={() => {
                const selectedGender = perfumeNavSelection.gender;
                setShopTypeId(type.id);
                clearAll();
                if (showPerfumeGenderNav && selectedGender) {
                  setPerfumeNavSelection({ gender: selectedGender, typeKey: null, lineKey: null });
                }
                revealLoadingState();
              }}
            >
              <span className="collection-shop-type-photo" aria-hidden="true">
                {(() => {
                  const representative = products.find((product) =>
                    matchesShopType(product, type.tokens) && Boolean(getDisplayImageUrl(product))
                  );
                  const image = representative ? getDisplayImageUrl(representative) : "";
                  return image ? <img src={image} alt="" /> : <span>✦</span>;
                })()}
              </span>
              <span>{type.label}</span><small>{type.count}</small>
            </button>
          ))}
        </div>
      </section> : null}

      {categorySlug && !shopTypeId ? (
        recommendedSection
      ) : (
      <div className="product-listing-layout">
      <button
        type="button"
        className="product-refine-trigger"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen(true)}
      >
        Refine results <span>{hasActiveFilters ? chips.length + Number(priceFilterActive) + Number(hasPerfumeNavFilter) : ""}</span>
      </button>
      {showFilterAside ? (
        <aside className={`product-filters-aside${filtersOpen ? " is-open" : ""}`} aria-label="Product filters">
          <div className="product-refine-mobile-head">
            <strong>Refine results</strong>
            <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters">×</button>
          </div>
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
                    aria-label={`Remove minimum price ${formatMoney(priceBounds.min)}`}
                    role="listitem"
                  >
                    <span className="product-filter-chip-facet">Price</span>
                    <span className="product-filter-chip-sep">·</span>
                    <span>Min {formatMoney(priceBounds.min)}</span>
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
                    aria-label={`Remove maximum price ${formatMoney(priceBounds.max)}`}
                    role="listitem"
                  >
                    <span className="product-filter-chip-facet">Price</span>
                    <span className="product-filter-chip-sep">·</span>
                    <span>Max {formatMoney(priceBounds.max)}</span>
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
        <div className="product-listing-toolbar">
          <span>{filtered.length} {filtered.length === 1 ? "product" : "products"}</span>
          <label>
            <span>Sort by</span>
            <select value={sortBy} onChange={(event) => { setSortBy(event.target.value as ProductSort); revealLoadingState(); }}>
              <option value="featured">Featured</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
        <div className={`product-grid${isGridLoading ? " is-loading" : ""}`} aria-busy={isGridLoading}>
          {isGridLoading ? Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="product-grid-skeleton" aria-hidden="true">
              <span className="product-grid-skeleton-image" />
              <span className="product-grid-skeleton-line is-wide" />
              <span className="product-grid-skeleton-line" />
            </div>
          )) : sortedProducts.map((product) => {
            const imageSrc = getDisplayImageUrl(product);
            const priceState = productPriceState(product);
            const convertedPrice = formatCatalogPrice(priceState.active);
            const priceLabel = convertedPrice ? `${isEstimated ? "≈ " : ""}${convertedPrice}` : "Price on request";
            return (
              <div key={product.id} className="product-card-wrap">
                <Link
                  href={searchQuery.trim()
                    ? `/product/${product.id}?search=${encodeURIComponent(searchQuery.trim())}`
                    : `/product/${product.id}`}
                  className="product-card-link"
                >
                  <article className="product-card">
                    <div className="product-card-media">
                      <div className="product-image">
                        {imageSrc ? (
                          <img src={imageSrc} alt={`${decodeBasicHtmlEntities(product.name)} — Maroma`} style={{ transform: productImageTransform(product.id) }} />
                        ) : (
                          <span>No image</span>
                        )}
                      </div>
                      {isGiftingProduct(product) && isGift3dPreviewProduct(product.id) ? (
                        <span className="product-card-3d-badge">
                          3D
                        </span>
                      ) : null}
                    </div>
                    <div className="product-copy">
                      <h3 className="product-card-title">{decodeBasicHtmlEntities(product.name)}</h3>
                      <p className={priceState.onSale ? "product-card-price is-on-sale" : "product-card-price"}>
                        {priceState.onSale ? <s>{formatCatalogPrice(priceState.regular)}</s> : null}
                        <span>{priceLabel}</span>
                      </p>
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
            {products.length === 0 && searchQuery.trim()
              ? "No products match this search. Try fewer words or a different spelling."
              : "No products match these filters. Try clearing some attributes or the price range."}
          </p>
        ) : null}
      </div>
    </div>
      )}
      {shopTypeId ? recommendedSection : null}
    </div>
  );
}
