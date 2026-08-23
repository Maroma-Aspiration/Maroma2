import type { StoreLocation } from "./store-locator-types";

const GLOBAL_ALIASES: Record<string, string[]> = {
  usa: ["united states", "america", "us", "u.s.", "u.s.a."],
  us: ["united states", "america", "usa"],
  uk: ["united kingdom", "britain", "england", "great britain"],
  uae: ["united arab emirates", "emirates", "dubai"],
  fl: ["florida", "miami"],
  india: ["bharat", "in"],
};

const KIND_LABELS: Record<StoreLocation["kind"], string> = {
  store: "Boutique",
  outlet: "Outlet",
  spa: "Spa",
  cafe: "Café",
  distributor: "Distributor",
  retailer: "Retailer",
};

export function storeKindLabel(kind: StoreLocation["kind"]): string {
  return KIND_LABELS[kind] ?? kind;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandToken(token: string): string[] {
  const normalized = normalizeText(token);
  if (!normalized) return [];
  const variants = new Set<string>([normalized]);
  for (const [key, aliases] of Object.entries(GLOBAL_ALIASES)) {
    if (normalized === key || aliases.includes(normalized)) {
      variants.add(key);
      aliases.forEach((alias) => variants.add(normalizeText(alias)));
    }
  }
  return Array.from(variants);
}

function locationSearchBlob(location: StoreLocation): string {
  const parts = [
    location.name,
    location.kind,
    storeKindLabel(location.kind),
    location.address,
    location.city,
    location.region,
    location.country,
    location.postalCode,
    location.phone,
    location.email,
    ...(location.searchTerms ?? []),
  ];
  return normalizeText(parts.filter(Boolean).join(" "));
}

function tokenMatchesBlob(token: string, blob: string): boolean {
  const variants = expandToken(token);
  return variants.some((variant) => blob.includes(variant));
}

export function filterStoreLocations(locations: StoreLocation[], query: string): StoreLocation[] {
  const q = query.trim();
  if (!q) return locations;

  const tokens = normalizeText(q).split(" ").filter(Boolean);
  if (tokens.length === 0) return locations;

  return locations.filter((location) => {
    const blob = locationSearchBlob(location);
    return tokens.every((token) => tokenMatchesBlob(token, blob));
  });
}

export type StoreRegionFilter = "all" | "india" | "international";

export function filterStoreLocationsByRegion(
  locations: StoreLocation[],
  region: StoreRegionFilter
): StoreLocation[] {
  if (region === "all") return locations;
  if (region === "india") {
    return locations.filter((l) => normalizeText(l.country) === "india");
  }
  return locations.filter((l) => normalizeText(l.country) !== "india");
}

export type StoreKindFilter = StoreLocation["kind"] | "all";

export function filterStoreLocationsByKind(
  locations: StoreLocation[],
  kind: StoreKindFilter
): StoreLocation[] {
  if (kind === "all") return locations;
  return locations.filter((l) => l.kind === kind);
}

export function sortStoreLocations(locations: StoreLocation[]): StoreLocation[] {
  const kindOrder: Record<StoreLocation["kind"], number> = {
    outlet: 0,
    store: 1,
    spa: 2,
    cafe: 3,
    retailer: 4,
    distributor: 5,
  };

  return [...locations].sort((a, b) => {
    const countryA = normalizeText(a.country) === "india" ? 0 : 1;
    const countryB = normalizeText(b.country) === "india" ? 0 : 1;
    if (countryA !== countryB) return countryA - countryB;
    const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
    if (kindDiff !== 0) return kindDiff;
    return a.name.localeCompare(b.name);
  });
}
