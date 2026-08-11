import type {
  GiftBox,
  GiftBuilderCatalog,
  GiftCardPreset,
  GiftElement,
  GiftEventPreset,
  GiftQuantityTier,
} from "./gift-builder-types";

export const GIFT_BOXES: GiftBox[] = [
  {
    id: "petite",
    name: "Small",
    description: "A compact box for three thoughtful favourites.",
    image: "/staging-media/wp-content/uploads/2023/08/EA35-D21_Perfume-Mats-Lavender-001-copy.jpg",
    slotCount: 3,
    basePrice: 150,
  },
  {
    id: "classic",
    name: "Medium",
    description: "Our balanced four-piece set with room for scent, care, and calm.",
    image: "/staging-media/wp-content/uploads/2021/06/Asian-Delights-01.jpg",
    slotCount: 4,
    basePrice: 250,
  },
  {
    id: "grand",
    name: "Large",
    description: "Five curated elements for a generous, layered gift.",
    image: "/staging-media/wp-content/uploads/2023/08/Aromatic-Candle-Jasmine-Sambac-75gm-001-copy.jpg",
    slotCount: 5,
    basePrice: 400,
  },
];

/** Curated element IDs map to catalogue product IDs — prices/images enriched at runtime. */
export const GIFT_ELEMENT_DEFS: Array<
  Omit<GiftElement, "price" | "image"> & { fallbackPrice: number; fallbackImage: string }
> = [
  {
    id: "incense-lemongrass",
    productId: "2599",
    name: "Lemongrass Incense",
    description: "Bright, uplifting coils of lemongrass, ten sticks to soften any room.",
    category: "scent",
    fallbackPrice: 260,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/Lemongrass-Incense-01.webp",
  },
  {
    id: "incense-lavender",
    productId: "2610",
    name: "Lavender Incense",
    description: "Calming lavender in a clean-burning ten-stick pack.",
    category: "scent",
    fallbackPrice: 260,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/Lemongrass-Incense-01.webp",
  },
  {
    id: "incense-cedar",
    productId: "2615",
    name: "Cedarwood Incense",
    description: "Grounding cedarwood notes for evening rituals.",
    category: "scent",
    fallbackPrice: 260,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/Lemongrass-Incense-01.webp",
  },
  {
    id: "soap-cedar-lavender",
    productId: "775",
    name: "Cedar Lavender Soap",
    description: "Cold-pressed aromatic bath soap with a woody-floral heart.",
    category: "soap",
    fallbackPrice: 480,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/ML29-A27_001-copy-1.jpg",
  },
  {
    id: "soap-tonka",
    productId: "780",
    name: "Tonka Vetiver Soap",
    description: "Warm, earthy lather crafted for slow evening baths.",
    category: "soap",
    fallbackPrice: 480,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/ML29-A27_001-copy-1.jpg",
  },
  {
    id: "soap-orange-patchouli",
    productId: "785",
    name: "Orange Patchouli Soap",
    description: "Citrus lift with a deep patchouli base, balanced and bright.",
    category: "soap",
    fallbackPrice: 480,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/ML29-A27_001-copy-1.jpg",
  },
  {
    id: "votive-clarity",
    productId: "5944",
    name: "Kalki Votive, Clarity",
    description: "A 70g vegetal-wax votive to bring soft light and focus.",
    category: "candle",
    fallbackPrice: 420,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/Aromatic-Candle_Red-Rose-75gm-001-copy.jpg",
  },
  {
    id: "votive-peace",
    productId: "5950",
    name: "Kalki Votive, Inner Peace",
    description: "A gentle flame for quiet moments and unhurried evenings.",
    category: "candle",
    fallbackPrice: 420,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/Aromatic-Candle_Jasmine-Sambac-75gm-001-copy.jpg",
  },
  {
    id: "perfume-cedar",
    productId: "795",
    name: "Cedar Lavender Perfume",
    description: "A roll-on oil perfume with woody-floral depth.",
    category: "wellness",
    fallbackPrice: 650,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/EA35-D21_Perfume-Mats-Lavender-001-copy.jpg",
  },
  {
    id: "spray-lemongrass",
    productId: "2730",
    name: "Lemongrass Body Spray",
    description: "A refreshing mist to revive skin and senses.",
    category: "wellness",
    fallbackPrice: 690,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/Lemongrass-Incense-01.webp",
  },
  {
    id: "spray-lavender",
    productId: "2734",
    name: "Lavender Body Spray",
    description: "Soft lavender in a light, wearable spray.",
    category: "wellness",
    fallbackPrice: 690,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/EA35-D21_Perfume-Mats-Lavender-001-copy.jpg",
  },
  {
    id: "spray-clear-mind",
    productId: "4125",
    name: "Clear Mind Spray",
    description: "Aromatherapy mist to clear and uplift your space.",
    category: "accent",
    fallbackPrice: 995,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/Aromatic-Candle_Red-Rose-75gm-001-copy.jpg",
  },
  {
    id: "hand-cream",
    productId: "2412",
    name: "Nourishing Hand Cream",
    description: "Rich botanical care for hands that work hard.",
    category: "wellness",
    fallbackPrice: 1305,
    fallbackImage: "/staging-media/wp-content/uploads/2023/08/ML29-A27_001-copy-1.jpg",
  },
];

export const GIFT_EVENT_PRESETS: GiftEventPreset[] = [
  {
    id: "birthday",
    event: "birthday",
    track: "personal",
    label: "Birthday",
    description: "Bright scents and a votive for a joyful celebration.",
    boxId: "classic",
    elementIds: ["incense-lemongrass", "soap-orange-patchouli", "votive-clarity", "spray-lemongrass"],
  },
  {
    id: "wedding",
    event: "wedding",
    track: "personal",
    label: "Wedding & anniversary",
    description: "Layered florals and calm for a memorable occasion.",
    boxId: "grand",
    elementIds: ["incense-lavender", "soap-cedar-lavender", "votive-peace", "perfume-cedar", "hand-cream"],
  },
  {
    id: "festival",
    event: "festival",
    track: "personal",
    label: "Festival & Diwali",
    description: "Warm incense, candlelight, and ritual care.",
    boxId: "grand",
    elementIds: ["incense-cedar", "incense-lavender", "votive-clarity", "soap-tonka", "spray-clear-mind"],
  },
  {
    id: "new-baby",
    event: "new-baby",
    track: "personal",
    label: "New baby",
    description: "Gentle, soft scents in a petite keepsake box.",
    boxId: "petite",
    elementIds: ["incense-lavender", "soap-cedar-lavender", "votive-peace"],
  },
  {
    id: "self-care",
    event: "self-care",
    track: "personal",
    label: "Self-care ritual",
    description: "A personal pause: spray, soap, and candle.",
    boxId: "petite",
    elementIds: ["spray-lavender", "soap-tonka", "votive-clarity"],
  },
  {
    id: "corporate",
    event: "corporate",
    track: "corporate",
    label: "Corporate thank-you",
    description: "Understated favourites suited to clients, partners, and teams.",
    boxId: "classic",
    elementIds: ["incense-cedar", "soap-cedar-lavender", "spray-clear-mind", "votive-peace"],
  },
  {
    id: "corporate-client",
    event: "corporate",
    track: "corporate",
    label: "Client appreciation",
    description: "Refined scent and care for valued client relationships.",
    boxId: "classic",
    elementIds: ["incense-lavender", "soap-cedar-lavender", "perfume-cedar", "votive-peace"],
  },
  {
    id: "corporate-milestone",
    event: "corporate",
    track: "corporate",
    label: "Team milestone",
    description: "Celebrate achievements with a generous, layered set.",
    boxId: "grand",
    elementIds: ["incense-cedar", "soap-tonka", "votive-clarity", "spray-clear-mind", "hand-cream"],
  },
];

export const GIFT_QUANTITY_TIERS: GiftQuantityTier[] = [
  { minQty: 1, label: "1 box", discountRate: 0 },
  { minQty: 3, label: "3 boxes", discountRate: 0.05 },
  { minQty: 5, label: "5 boxes", discountRate: 0.1 },
  { minQty: 10, label: "10 boxes", discountRate: 0.15 },
];

export const GIFT_CARD_PRESETS: GiftCardPreset[] = [
  {
    id: "botanical",
    name: "Botanical",
    description: "Soft greens with a leaf motif, calm and natural.",
    suggestedMessage: "Wishing you moments of calm and joy.",
    price: 95,
    style: "botanical",
  },
  {
    id: "festive",
    name: "Festive",
    description: "Warm gold tones for celebrations and gatherings.",
    suggestedMessage: "Celebrate the season with warmth and light.",
    price: 95,
    style: "festive",
  },
  {
    id: "celebration",
    name: "Celebration",
    description: "A blush rose wash for birthdays and milestones.",
    suggestedMessage: "Happy birthday. Enjoy every beautiful moment.",
    price: 95,
    style: "celebration",
  },
  {
    id: "thank-you",
    name: "Thank you",
    description: "Clean teal accents for a gracious note of thanks.",
    suggestedMessage: "Thank you. Your kindness means the world.",
    price: 95,
    style: "thank-you",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Cream card with a simple border and room for your words.",
    suggestedMessage: "With love, from all of us at Maroma.",
    price: 95,
    style: "minimal",
  },
];

export function getGiftCardPreset(cardId: string): GiftCardPreset | null {
  return GIFT_CARD_PRESETS.find((card) => card.id === cardId) ?? null;
}

export function getStaticGiftBuilderCatalog(): GiftBuilderCatalog {
  const elements: GiftElement[] = GIFT_ELEMENT_DEFS.map((def) => ({
    id: def.id,
    productId: def.productId,
    name: def.name,
    description: def.description,
    category: def.category,
    image: def.fallbackImage,
    price: def.fallbackPrice,
  }));

  return {
    boxes: GIFT_BOXES,
    elements,
    presets: GIFT_EVENT_PRESETS,
    quantityTiers: GIFT_QUANTITY_TIERS,
    cardPresets: GIFT_CARD_PRESETS,
  };
}

export function getGiftBox(boxId: string): GiftBox | null {
  return GIFT_BOXES.find((box) => box.id === boxId) ?? null;
}

export function getGiftElement(elementId: string): GiftElement | null {
  const def = GIFT_ELEMENT_DEFS.find((entry) => entry.id === elementId);
  if (!def) return null;
  return {
    id: def.id,
    productId: def.productId,
    name: def.name,
    description: def.description,
    category: def.category,
    image: def.fallbackImage,
    price: def.fallbackPrice,
  };
}
