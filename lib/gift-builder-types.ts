export type GiftElementCategory = "scent" | "soap" | "candle" | "wellness" | "accent";

export type GiftTrack = "personal" | "corporate";

export type GiftBox = {
  id: string;
  name: string;
  description: string;
  image: string;
  slotCount: number;
  basePrice: number;
  /** Internal usable dimensions. */
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** Optional photograph taken directly above the empty box. */
  topImage?: string;
};

export type GiftSizeGroup = "small" | "medium" | "large";

export type GiftElement = {
  id: string;
  productId: string;
  name: string;
  description: string;
  category: GiftElementCategory;
  image: string;
  price: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  sizeGroup: GiftSizeGroup;
};

export type PackedGift = {
  elementId: string;
  x: number;
  y: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  rotated: boolean;
};

export type GiftEventPreset = {
  id: string;
  event: string;
  track: GiftTrack;
  label: string;
  description: string;
  boxId: string;
  elementIds: string[];
};

export type GiftQuantityTier = {
  minQty: number;
  label: string;
  discountRate: number;
};

export type GiftCardPreset = {
  id: string;
  name: string;
  description: string;
  /** Suggested opening line — shopper can edit or replace. */
  suggestedMessage: string;
  price: number;
  /** CSS modifier for the illustrated card face. */
  style: "botanical" | "festive" | "minimal" | "celebration" | "thank-you";
};

export type GiftBuilderCatalog = {
  boxes: GiftBox[];
  elements: GiftElement[];
  presets: GiftEventPreset[];
  quantityTiers: GiftQuantityTier[];
  cardPresets: GiftCardPreset[];
};

export type GiftSetDraft = {
  id: string;
  name: string;
  track: GiftTrack;
  boxId: string;
  slots: string[];
  presetId?: string;
  cardId?: string;
  cardMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type GiftSetCollectionItem = GiftSetDraft & {
  unitPrice: number;
  completedAt: string;
};
