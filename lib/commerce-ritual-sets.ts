import type { CommerceProduct } from "./commerce-types";

/** Curated ritual bundles — server-known only so clients cannot invent prices. */
export const RITUAL_SETS: Record<
  string,
  CommerceProduct & { description: string; discountRate: number }
> = {
  "ambient-bliss": {
    id: "ambient-bliss",
    sku: "ambient-bliss",
    name: "Ambient Bliss",
    price: 1250,
    image: "/staging-media/wp-content/uploads/2023/08/Aromatic-Candle_Red-Rose-75gm-001-copy.jpg",
    active: true,
    stock: 50,
    virtual: true,
    description: "A harmonious blend of flame and fragrance to soften the atmosphere.",
    discountRate: 0.1,
  },
  "sacred-space": {
    id: "sacred-space",
    sku: "sacred-space",
    name: "Sacred Space",
    price: 1850,
    image: "/staging-media/wp-content/uploads/2023/08/AC24-F26-Ceramic-Spiral-Burner-Star-001-copy-.jpg",
    active: true,
    stock: 50,
    virtual: true,
    description: "Pure botanical essences diffused to clear the mind and ground the spirit.",
    discountRate: 0.1,
  },
  "luminous-calm": {
    id: "luminous-calm",
    sku: "luminous-calm",
    name: "Luminous Calm",
    price: 2100,
    image: "/staging-media/wp-content/uploads/2023/08/Aromatic-Candle_Jasmine-Sambac-75gm-001-copy.jpg",
    active: true,
    stock: 50,
    virtual: true,
    description: "The gentle warmth of a candle paired with the continuous diffusion of calming oils.",
    discountRate: 0.1,
  },
  "aromatic-flow": {
    id: "aromatic-flow",
    sku: "aromatic-flow",
    name: "Aromatic Flow",
    price: 1400,
    image: "/staging-media/wp-content/uploads/2025/09/Lemongrass-Incense-01.webp",
    active: true,
    stock: 50,
    virtual: true,
    description: "A dynamic duo of incense and oils to energize your living environment.",
    discountRate: 0.1,
  },
};

export function getRitualSet(productId: string) {
  return RITUAL_SETS[productId] ?? null;
}
