import { readJsonKv, writeJsonKv } from "./json-kv-store";
import { defaultStoreLocations } from "./store-locator-defaults";
import { sortStoreLocations } from "./store-locator-search";
import type { StoreLocation } from "./store-locator-types";

export type { StoreLocation } from "./store-locator-types";
export { defaultStoreLocations } from "./store-locator-defaults";

type LocatorStore = { locations: StoreLocation[] };

const KEY = "maroma:store-locator";
const FILE = "store-locator.json";

function parseLocation(raw: unknown): StoreLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!id || !name) return null;
  const kind = row.kind;
  const searchTerms = Array.isArray(row.searchTerms)
    ? row.searchTerms.filter((term): term is string => typeof term === "string" && term.trim().length > 0)
    : undefined;
  return {
    id,
    name,
    kind:
      kind === "store" ||
      kind === "outlet" ||
      kind === "spa" ||
      kind === "cafe" ||
      kind === "distributor" ||
      kind === "retailer"
        ? kind
        : "retailer",
    address: typeof row.address === "string" ? row.address : "",
    city: typeof row.city === "string" ? row.city : "",
    region: typeof row.region === "string" ? row.region : "",
    country: typeof row.country === "string" ? row.country : "",
    postalCode: typeof row.postalCode === "string" ? row.postalCode : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : "",
    website: typeof row.website === "string" ? row.website : "",
    lat: typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : null,
    lng: typeof row.lng === "number" && Number.isFinite(row.lng) ? row.lng : null,
    searchTerms,
  };
}

/** Keep admin edits while ensuring the public catalog includes all default locations. */
function mergeWithDefaultCatalog(stored: StoreLocation[]): StoreLocation[] {
  const byId = new Map<string, StoreLocation>();
  for (const location of stored) {
    byId.set(location.id, location);
  }
  for (const location of defaultStoreLocations()) {
    if (!byId.has(location.id)) {
      byId.set(location.id, location);
    }
  }
  return sortStoreLocations(Array.from(byId.values()));
}

export async function readStoreLocator(): Promise<LocatorStore> {
  const fallback = { locations: defaultStoreLocations() };
  const stored = await readJsonKv<LocatorStore>(KEY, FILE, fallback);
  const locations = (stored.locations ?? []).map(parseLocation).filter((l): l is StoreLocation => Boolean(l));
  return { locations: mergeWithDefaultCatalog(locations.length ? locations : defaultStoreLocations()) };
}

export async function writeStoreLocator(store: LocatorStore): Promise<void> {
  await writeJsonKv(KEY, FILE, store);
}

export async function upsertStoreLocation(input: Partial<StoreLocation> & { name: string }): Promise<StoreLocation> {
  const store = await readStoreLocator();
  const existing = input.id ? store.locations.find((l) => l.id === input.id) : null;
  const location: StoreLocation = {
    id: existing?.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    kind: input.kind ?? existing?.kind ?? "retailer",
    address: input.address ?? existing?.address ?? "",
    city: input.city ?? existing?.city ?? "",
    region: input.region ?? existing?.region ?? "",
    country: input.country ?? existing?.country ?? "",
    postalCode: input.postalCode ?? existing?.postalCode ?? "",
    phone: input.phone ?? existing?.phone ?? "",
    email: input.email ?? existing?.email ?? "",
    website: input.website ?? existing?.website ?? "",
    lat: input.lat === undefined ? existing?.lat ?? null : input.lat,
    lng: input.lng === undefined ? existing?.lng ?? null : input.lng,
    searchTerms: input.searchTerms ?? existing?.searchTerms,
  };
  store.locations = existing
    ? store.locations.map((l) => (l.id === location.id ? location : l))
    : [location, ...store.locations];
  await writeStoreLocator(store);
  return location;
}

export async function deleteStoreLocation(id: string): Promise<boolean> {
  const store = await readStoreLocator();
  const next = store.locations.filter((l) => l.id !== id);
  if (next.length === store.locations.length) return false;
  await writeStoreLocator({ locations: next });
  return true;
}
