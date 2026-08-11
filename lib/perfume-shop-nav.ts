import type { ProductRecord } from "./product-types";

export type PerfumeGender = "men" | "women";

export type PerfumeLineGroup = {
  line: string;
  key: string;
  productIds: string[];
};

export type PerfumeTypeGroup = {
  type: string;
  key: string;
  lines: PerfumeLineGroup[];
  productCount: number;
};

export type PerfumeGenderNav = {
  gender: PerfumeGender;
  label: string;
  types: PerfumeTypeGroup[];
  productCount: number;
};

export type PerfumeNavSelection = {
  gender: PerfumeGender | null;
  typeKey: string | null;
  lineKey: string | null;
};

const EXCLUDE_PRODUCT =
  /incense|diffuser|essential oil|room mist|potpourri|reed stick|ceramic|gift voucher|shaving|bath salt|spiral|ambient perfume|perfume spiral|home fragrance|aromatherapy spray|aromatherapy roll|perfume mat|spa blend|colibri roll|foot soak|shampoo|soap|lotion|body wash|uplifting room|delight room|recharge room|stress away|nurture room|dream room|gift set|set of 2|set of 3|\(p\/2\)/i;

const MEN_PATTERN = /\bmen\b|for man\b|for men\b|men's|men’s/i;

const TYPE_ORDER = ["Perfume Oil", "Roll-On", "Eau de Toilette", "Eau de Parfum", "Solid Perfume", "Devi"];

function slugKey(...parts: string[]): string {
  return parts
    .join("::")
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, "-")
    .replace(/-+/g, "-");
}

export function isCorePerfumeProduct(product: ProductRecord): boolean {
  const name = product.name;
  if (EXCLUDE_PRODUCT.test(name)) {
    return false;
  }
  const hay = [name, ...(product.categories ?? []), ...(product.tags ?? [])].join(" ");
  if (MEN_PATTERN.test(hay)) {
    return true;
  }
  if (/perfume oil|eau de toilette|eau de parfum|solid perfume|maroma perfume|devi perfume/i.test(name)) {
    return true;
  }
  if (product.categories?.some((c) => /^(Men|Women) > Fragrance|^Perfumes >/i.test(c))) {
    return true;
  }
  return false;
}

export function getPerfumeGender(product: ProductRecord): PerfumeGender {
  const hay = [product.name, ...(product.categories ?? [])].join(" ");
  return MEN_PATTERN.test(hay) ? "men" : "women";
}

function perfumeFormatAttrs(product: ProductRecord): string[] {
  const attrs = product.attributes ?? {};
  const fromPerfume = attrs.Perfume ?? attrs.perfume ?? [];
  const fromFormat = attrs.Format ?? attrs.format ?? [];
  return [...fromPerfume, ...fromFormat].map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function isRollOnPerfume(product: ProductRecord): boolean {
  const name = product.name.toLowerCase();
  if (/deodorant|aromatherapy|colibri/i.test(name)) {
    return false;
  }
  if (/roll\s*on|rollon/i.test(name)) {
    return true;
  }
  return perfumeFormatAttrs(product).includes("roll on");
}

function isBottlePerfume(product: ProductRecord): boolean {
  const name = product.name.toLowerCase();
  if (/deodorant|aromatherapy|colibri/i.test(name)) {
    return false;
  }
  if (name.endsWith("- bottle") || /\bbottle\b/i.test(name)) {
    return true;
  }
  if (/perfume oil|maroma perfume/i.test(name) && !/roll\s*on\/perfume oil - roll on/i.test(name)) {
    return true;
  }
  return perfumeFormatAttrs(product).includes("bottle");
}

/** A product may appear in more than one format (e.g. bottle + roll-on). */
export function getPerfumeTypes(product: ProductRecord): string[] {
  const name = product.name.toLowerCase();
  if (/eau de toilette|\bedt\b/i.test(name)) {
    return ["Eau de Toilette"];
  }
  if (/eau de parfum|\bedp\b/i.test(name)) {
    return ["Eau de Parfum"];
  }
  if (/solid perfume/i.test(name)) {
    return ["Solid Perfume"];
  }
  if (/devi perfume/i.test(name)) {
    return ["Devi"];
  }

  const types: string[] = [];
  if (isRollOnPerfume(product)) {
    types.push("Roll-On");
  }
  if (isBottlePerfume(product)) {
    types.push("Perfume Oil");
  }
  if (types.length === 0 && /perfume/i.test(name)) {
    types.push("Perfume Oil");
  }
  return types;
}

export function getPerfumeType(product: ProductRecord): string {
  return getPerfumeTypes(product)[0] ?? "Perfume Oil";
}

function normalizeLineLabel(product: ProductRecord, type: string): string {
  let name = product.name.replace(/&amp;/g, "&").trim();
  name = name.replace(/\s*[-–]\s*(10\s*ml|50\s*ml|8\s*gms?|bottle|roll\s*on).*$/i, "");
  name = name.replace(
    /\s+(roll\s*on\/?\s*perfume\s*oil|perfume\s*oil|eau\s*de\s*toilette.*|solid\s*perfume.*|for\s*man.*)$/i,
    ""
  );
  name = name.replace(/\s+roll\s*on$/i, "");

  if (type === "Eau de Toilette") {
    const collection = name.match(/^(Elevate|Captivate|Intrigue|Emanate)/i);
    if (collection) {
      const label = collection[1];
      return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    }
  }

  if (type === "Perfume Oil" && MEN_PATTERN.test(name)) {
    name = name
      .replace(/\s+men['']s?\s+(oil\s+)?perfume$/i, "")
      .replace(/\s+men['']s?\s+perfume$/i, "")
      .trim();
  }

  name = name.replace(/^maroma perfume\s+/i, "");
  name = name.replace(/^devi perfume\s+/i, "Devi ");
  name = name.replace(/^solid perfume\s+/i, "");

  return name.trim();
}

export function buildPerfumeGenderNav(products: ProductRecord[]): PerfumeGenderNav[] {
  const buckets: Record<
    PerfumeGender,
    Map<string, { type: string; lines: Map<string, PerfumeLineGroup> }>
  > = {
    men: new Map(),
    women: new Map(),
  };

  for (const product of products) {
    if (!isCorePerfumeProduct(product)) {
      continue;
    }
    const gender = getPerfumeGender(product);
    const types = getPerfumeTypes(product);
    if (!types.length) {
      continue;
    }

    for (const type of types) {
      const line = normalizeLineLabel(product, type);
      if (!line) {
        continue;
      }

      const typeKey = slugKey(gender, type);
      const genderMap = buckets[gender];
      if (!genderMap.has(typeKey)) {
        genderMap.set(typeKey, { type, lines: new Map() });
      }
      const typeBucket = genderMap.get(typeKey)!;
      const lineKey = slugKey(gender, type, line);
      if (!typeBucket.lines.has(lineKey)) {
        typeBucket.lines.set(lineKey, { line, key: lineKey, productIds: [] });
      }
      const lineBucket = typeBucket.lines.get(lineKey)!;
      if (!lineBucket.productIds.includes(product.id)) {
        lineBucket.productIds.push(product.id);
      }
    }
  }

  return (["men", "women"] as PerfumeGender[])
    .map((gender) => {
      const genderMap = buckets[gender];
      const types: PerfumeTypeGroup[] = [];

      for (const typeLabel of TYPE_ORDER) {
        const typeKey = slugKey(gender, typeLabel);
        const typeBucket = genderMap.get(typeKey);
        if (!typeBucket?.lines.size) {
          continue;
        }
        const lines = [...typeBucket.lines.values()].sort((a, b) => a.line.localeCompare(b.line));
        const productCount = lines.reduce((sum, line) => sum + line.productIds.length, 0);
        types.push({
          type: typeLabel,
          key: typeKey,
          lines,
          productCount,
        });
      }

      const productCount = types.reduce((sum, type) => sum + type.productCount, 0);
      return {
        gender,
        label: gender === "men" ? "Men" : "Women",
        types,
        productCount,
      };
    })
    .filter((section) => section.productCount > 0);
}

export function productMatchesPerfumeNavSelection(
  product: ProductRecord,
  selection: PerfumeNavSelection,
  nav: PerfumeGenderNav[]
): boolean {
  if (!selection.gender) {
    return true;
  }

  const section = nav.find((entry) => entry.gender === selection.gender);
  if (!section) {
    return false;
  }

  if (!selection.typeKey && !selection.lineKey) {
    return getPerfumeGender(product) === selection.gender && isCorePerfumeProduct(product);
  }

  for (const type of section.types) {
    if (selection.typeKey && type.key !== selection.typeKey) {
      continue;
    }
    for (const line of type.lines) {
      if (selection.lineKey && line.key !== selection.lineKey) {
        continue;
      }
      if (line.productIds.includes(product.id)) {
        return true;
      }
    }
  }

  return false;
}

export function perfumeSelectionLabel(
  selection: PerfumeNavSelection,
  nav: PerfumeGenderNav[]
): string | null {
  if (!selection.gender) {
    return null;
  }
  const section = nav.find((entry) => entry.gender === selection.gender);
  if (!section) {
    return null;
  }
  if (selection.lineKey) {
    for (const type of section.types) {
      const line = type.lines.find((entry) => entry.key === selection.lineKey);
      if (line) {
        return `${section.label} · ${line.line}`;
      }
    }
  }
  if (selection.typeKey) {
    const type = section.types.find((entry) => entry.key === selection.typeKey);
    if (type) {
      return `${section.label} · ${type.type}`;
    }
  }
  return section.label;
}
