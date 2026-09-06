import { readJsonKv, writeJsonKv } from "./json-kv-store";

export type ShippingRestrictedRegion = {
  id: string;
  name: string;
  areas: string[];
  enabled: boolean;
  productIds: string[];
  /** Keeps current catalogue restrictions intact until an admin chooses products explicitly. */
  includeLegacyTagged?: boolean;
};
export type ShippingRestrictionStore = { regions: ShippingRestrictedRegion[] };
const KV_KEY = "maroma:shipping-restrictions";
const FILE_NAME = "shipping-restrictions.json";
const defaultStore = (): ShippingRestrictionStore => ({ regions: [{ id: "uk-channel-islands", name: "United Kingdom & Channel Islands", areas: ["United Kingdom", "UK", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland", "Jersey", "Guernsey", "Alderney", "Sark"], enabled: true, productIds: [], includeLegacyTagged: true }] });
export async function readShippingRestrictions(): Promise<ShippingRestrictionStore> { const value = await readJsonKv<ShippingRestrictionStore>(KV_KEY, FILE_NAME, defaultStore()); return Array.isArray(value?.regions) ? value : defaultStore(); }
export async function writeShippingRestrictions(store: ShippingRestrictionStore): Promise<void> { await writeJsonKv(KV_KEY, FILE_NAME, store); }
export function matchingRestrictions(store: ShippingRestrictionStore, destination: string[], productIds: string[], legacyProductIds: string[]): ShippingRestrictedRegion[] {
  const places = destination.map((value) => value.trim().toLowerCase()).filter(Boolean);
  return store.regions.filter((region) => region.enabled && region.areas.some((area) => places.includes(area.trim().toLowerCase())) && (region.productIds.some((id) => productIds.includes(id)) || (region.includeLegacyTagged && legacyProductIds.length > 0)));
}
