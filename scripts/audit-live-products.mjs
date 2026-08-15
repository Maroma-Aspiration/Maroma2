import { readFileSync, writeFileSync } from "fs";

const local = JSON.parse(readFileSync("data/maroma-products.json", "utf8"));
const live = JSON.parse(readFileSync("/tmp/maroma-live-products.json", "utf8"));
const decode = (value) => String(value || "")
  .replace(/&#8211;|&ndash;/g, "-").replace(/&amp;/g, "&").replace(/&#0*39;|&apos;/g, "'");
const normalize = (value) => decode(value).toLowerCase().replace(/\bmaroma\b/g, "")
  .replace(/\b(pack of|pack)\b/g, " ").replace(/\b(ml|gms?|gm|grams?)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const normalizeLoose = (value) => normalize(value)
  .replace(/\b(10|15|20|30|50|60|75|80|100|120|150|200|250|300|500|600)\b/g, " ")
  .replace(/\s+/g, " ").trim();
const liveSku = new Set(live.map((p) => String(p.sku || "").trim().toLowerCase()).filter(Boolean));
const liveId = new Set(live.map((p) => String(p.id)));
const matches = new Map();
const candidatesByLiveId = new Map();
const unresolved = [];
let direct = 0, name = 0, ambiguous = 0, none = 0;
for (const product of local) {
  const sku = String(product.sku || "").trim().toLowerCase();
  if ((sku && liveSku.has(sku)) || liveId.has(String(product.id))) {
    const item = live.find((entry) => (sku && String(entry.sku || "").trim().toLowerCase() === sku) || String(entry.id) === String(product.id));
    direct++; matches.set(product.id, "direct");
    if (item) candidatesByLiveId.set(String(item.id), [...(candidatesByLiveId.get(String(item.id)) || []), { product, rank: String(item.id) === String(product.id) ? 3 : 2 }]);
    continue;
  }
  const candidates = live.filter((item) =>
    normalize(item.name) === normalize(product.name) || normalizeLoose(item.name) === normalizeLoose(product.name));
  if (candidates.length === 1) {
    name++; matches.set(product.id, "name");
    const item = candidates[0];
    candidatesByLiveId.set(String(item.id), [...(candidatesByLiveId.get(String(item.id)) || []), { product, rank: 1 }]);
  } else {
    if (candidates.length > 1) ambiguous++; else none++;
    unresolved.push({ id: product.id, sku: product.sku, name: product.name,
      reason: candidates.length ? "ambiguous" : "none",
      live: candidates.map((item) => ({ id: item.id, sku: item.sku, name: decode(item.name), type: item.type })) });
  }
}
const liveUnresolved = live.filter((item) => {
  const sku = String(item.sku || "").trim().toLowerCase();
  if (sku && local.some((p) => String(p.sku || "").trim().toLowerCase() === sku)) return false;
  if (local.some((p) => String(p.id) === String(item.id))) return false;
  return !local.some((p) => normalize(p.name) === normalize(item.name) || normalizeLoose(p.name) === normalizeLoose(item.name));
});
console.log(JSON.stringify({ direct, name, ambiguous, none, totalMatched: direct + name, liveUnresolved: liveUnresolved.length }, null, 2));
const selectedLocalIds = [];
for (const candidates of candidatesByLiveId.values()) {
  candidates.sort((a, b) => b.rank - a.rank || Number(Boolean(b.product.imageUrl)) - Number(Boolean(a.product.imageUrl)));
  selectedLocalIds.push(candidates[0].product.id);
}
console.log(JSON.stringify({ uniqueLiveProductsRepresented: selectedLocalIds.length, duplicateLocalRowsExcluded: direct + name - selectedLocalIds.length }, null, 2));
console.log("LIVE UNRESOLVED SAMPLE");
console.log(JSON.stringify(liveUnresolved.slice(0, 30).map((item) => ({ id: item.id, sku: item.sku,
  name: decode(item.name), type: item.type, parent: item.parent, variation: item.variation })), null, 2));
writeFileSync("/tmp/maroma-resolved-live-local-ids.json", JSON.stringify([...matches.keys()], null, 2));
writeFileSync("data/maroma-live-product-ids.json", `${JSON.stringify(selectedLocalIds, null, 2)}\n`);
writeFileSync("/tmp/maroma-unresolved-local.json", JSON.stringify(unresolved, null, 2));
