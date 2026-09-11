import { parseInrPriceNumber } from "./format-price";
import type { PromoCtaBuyLink } from "./promo-types";

export type PromoBuyLinkLabelLines = {
  title: string;
  subtitle: string;
  price: string;
};

const PROMO_PRODUCT_TYPE_SUFFIXES = [
  "Shower Gel",
  "Body Lotion",
  "Body Scrub",
  "Hand Wash",
  "Face Wash",
  "Face Cream",
  "Body Oil",
  "Massage Oil",
  "Essential Oil",
  "Room Spray",
  "Cone Incense",
  "Stick Incense",
  "Aromatic Candle",
  "Scented Candle",
  "Conditioner",
  "Shampoo",
  "Candle",
  "Incense",
  "Diffuser",
  "Lotion",
  "Cream",
  "Serum",
  "Mist",
  "Spray",
  "Gel",
  "Soap",
];

/** Compact INR for promo gift labels (e.g. Rs755). */
export function formatPromoBuyLinkPrice(priceRaw: string): string {
  const num = parseInrPriceNumber(priceRaw);
  if (num === null) {
    return "";
  }
  return `Rs${Math.round(num)}`;
}

export function splitPromoBuyLinkName(
  fullName: string,
  primaryCategory?: string
): { title: string; subtitle: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { title: "", subtitle: "" };
  }

  const sortedSuffixes = [...PROMO_PRODUCT_TYPE_SUFFIXES].sort((a, b) => b.length - a.length);
  for (const suffix of sortedSuffixes) {
    const pattern = new RegExp(`\\s+(${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})$`, "i");
    const match = trimmed.match(pattern);
    if (match?.index != null && match[1]) {
      const title = trimmed.slice(0, match.index).trim();
      if (title) {
        return { title, subtitle: match[1] };
      }
    }
  }

  if (primaryCategory) {
    const singular = primaryCategory.replace(/s$/i, "");
    const pattern = new RegExp(`\\s+(${singular.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})$`, "i");
    const match = trimmed.match(pattern);
    if (match?.index != null && match[1]) {
      const title = trimmed.slice(0, match.index).trim();
      if (title) {
        return { title, subtitle: match[1] };
      }
    }
  }

  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return {
      title: words.slice(0, -1).join(" "),
      subtitle: words[words.length - 1] ?? "",
    };
  }

  return { title: trimmed, subtitle: "" };
}

export function resolvePromoBuyLinkLabelLines(link: PromoCtaBuyLink): PromoBuyLinkLabelLines {
  const explicitTitle = link.label?.trim() ?? "";
  const explicitSubtitle = link.subtitleLabel?.trim() ?? "";
  const explicitPrice = link.priceLabel?.trim() ?? "";

  if (explicitSubtitle || explicitPrice) {
    return {
      title: explicitTitle,
      subtitle: explicitSubtitle,
      price: explicitPrice,
    };
  }

  if (explicitTitle) {
    const split = splitPromoBuyLinkName(explicitTitle);
    return {
      title: split.title,
      subtitle: split.subtitle,
      price: "",
    };
  }

  return { title: "", subtitle: "", price: "" };
}

export function createPromoBuyLinkId(): string {
  return crypto.randomUUID();
}

function emptySlot(side: "left" | "right", index: number): PromoCtaBuyLink {
  return {
    id: `cta-buy-${side}-${index}`,
    side,
    label: "",
    href: "",
    imageUrl: "",
  };
}

export function buildDefaultCtaBuyLinks(): PromoCtaBuyLink[] {
  return [
    emptySlot("left", 0),
    emptySlot("left", 1),
    emptySlot("left", 2),
    emptySlot("right", 0),
    emptySlot("right", 1),
    emptySlot("right", 2),
  ];
}

function normalizeOne(raw: unknown, side: "left" | "right", index: number): PromoCtaBuyLink {
  if (!raw || typeof raw !== "object") return emptySlot(side, index);
  const row = raw as Record<string, unknown>;
  return {
    id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : emptySlot(side, index).id,
    side: row.side === "right" ? "right" : "left",
    visible: row.visible !== false,
    label: typeof row.label === "string" ? row.label : "",
    subtitleLabel: typeof row.subtitleLabel === "string" ? row.subtitleLabel : "",
    priceLabel: typeof row.priceLabel === "string" ? row.priceLabel : "",
    href: typeof row.href === "string" ? row.href : "",
    imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : "",
  };
}

export function normalizeCtaBuyLinks(raw: unknown): PromoCtaBuyLink[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return buildDefaultCtaBuyLinks();
  }

  const parsed = raw.map((item, index) => {
    const side: "left" | "right" =
      item && typeof item === "object" && (item as Record<string, unknown>).side === "right"
        ? "right"
        : index >= 3
          ? "right"
          : "left";
    const slotIndex = side === "left" ? index % 3 : index % 3;
    return normalizeOne(item, side, slotIndex);
  });

  const left = parsed.filter((link) => link.side === "left").slice(0, 3);
  const right = parsed.filter((link) => link.side === "right").slice(0, 3);

  while (left.length < 3) left.push(emptySlot("left", left.length));
  while (right.length < 3) right.push(emptySlot("right", right.length));

  return [...left.slice(0, 3), ...right.slice(0, 3)];
}

export function splitCtaBuyLinks(links: PromoCtaBuyLink[]) {
  const normalized = normalizeCtaBuyLinks(links);
  return {
    left: normalized.filter((link) => link.side === "left"),
    right: normalized.filter((link) => link.side === "right"),
  };
}

export function isPromoBuyLinkVisible(link: PromoCtaBuyLink): boolean {
  return link.visible !== false && Boolean(link.href.trim() && link.imageUrl.trim());
}

export function visibleCtaBuyLinks(links: PromoCtaBuyLink[]) {
  const { left, right } = splitCtaBuyLinks(links);
  return {
    left: left.filter(isPromoBuyLinkVisible),
    right: right.filter(isPromoBuyLinkVisible),
  };
}
