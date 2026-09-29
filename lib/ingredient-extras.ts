export type IngredientExtra = {
  inci?: string;
  scentProfile?: string;
  extraNotes?: string;
  rangeLabel?: string;
  rangeHref?: string;
};

const FACE = { rangeLabel: "Explore Face Care", rangeHref: "/face-care" } as const;
const BODY = { rangeLabel: "Explore Body Care", rangeHref: "/body-care" } as const;
const HAIR = { rangeLabel: "Explore Hair Care", rangeHref: "/hair-care" } as const;
const HOME = { rangeLabel: "Explore Home Essentials", rangeHref: "/home-essentials" } as const;
const PERFUME = { rangeLabel: "Explore Perfumes", rangeHref: "/perfumes" } as const;

export const INGREDIENT_EXTRAS: Record<string, IngredientExtra> = {
  "aloe-vera": {
    inci: "Aloe Barbadensis Leaf Juice",
    scentProfile: "Fresh, watery, barely scented",
    extraNotes: "Used as a cooling gel base in face, body, and after-sun care.",
    ...FACE,
  },
  almond: {
    inci: "Prunus Amygdalus Dulcis (Sweet Almond) Oil",
    scentProfile: "Soft, faintly nutty",
    extraNotes: "A fine carrier oil in soaps, balms, and body care.",
    ...BODY,
  },
  amla: {
    inci: "Phyllanthus Emblica Fruit Extract",
    scentProfile: "Tart, green, herbal",
    extraNotes: "A classic Indian hair-care fruit used in shampoos and scalp rituals.",
    ...HAIR,
  },
  apricot: {
    inci: "Prunus Armeniaca (Apricot) Kernel Oil",
    scentProfile: "Light, softly peachy",
    extraNotes: "A quick-absorbing oil for face and body formulas that should not feel heavy.",
    ...FACE,
  },
  avocado: {
    inci: "Persea Gratissima (Avocado) Oil",
    scentProfile: "Mild, green, oily",
    extraNotes: "A richer oil for dry-skin butters and body care.",
    ...BODY,
  },
  basil: {
    inci: "Ocimum Basilicum Oil",
    scentProfile: "Green, spicy, kitchen-fresh",
    extraNotes: "A lifting herbal top note beside citrus and woods.",
    ...HOME,
  },
  bergamot: {
    inci: "Citrus Aurantium Bergamia Peel Oil",
    scentProfile: "Bitter-orange, floral, cologne-fresh",
    extraNotes: "Opens many Maroma blends with a classic eau-de-cologne sparkle.",
    ...PERFUME,
  },
  calendula: {
    inci: "Calendula Officinalis Flower Extract",
    scentProfile: "Soft herbal, faintly honeyed",
    extraNotes: "Chosen for gentle skin rituals, including baby care.",
    rangeLabel: "Explore Baby Care",
    rangeHref: "/baby",
  },
  "himalayan-cedarwood": {
    inci: "Cedrus Deodara Wood Oil",
    scentProfile: "Dry wood, pencil shaving, forest floor",
    extraNotes: "Grounds Colibri and home blends and is used for its freshening character.",
    rangeLabel: "Explore Colibri",
    rangeHref: "/colibri",
  },
  coconut: {
    inci: "Cocos Nucifera (Coconut) Oil",
    scentProfile: "Soft, tropical, familiar",
    extraNotes: "A Maroma base oil for soaps, butters, and hair care.",
    ...BODY,
  },
  geranium: {
    inci: "Pelargonium Graveolens Oil",
    scentProfile: "Green-rose, leafy, balanced",
    extraNotes: "A blending floral used to refresh skin and round a perfume.",
    ...FACE,
  },
  kokum: {
    inci: "Garcinia Indica Seed Butter",
    scentProfile: "Almost odourless, faintly nutty when warmed",
    extraNotes: "A firm Indian butter that melts on skin and leaves a powder-soft, non-greasy finish. The fruit is deep purple-red; the butter used in formulas is pale.",
    ...BODY,
  },
  lavender: {
    inci: "Lavandula Angustifolia Oil",
    scentProfile: "Clean floral, herbal, calming",
    extraNotes: "Used across body, home, and sleep-adjacent rituals.",
    ...HOME,
  },
  lemon: {
    inci: "Citrus Limon Peel Oil",
    scentProfile: "Bright, zest, sparkling citrus",
    extraNotes: "A waking top note in balms, soaps, and home fragrance.",
    ...BODY,
  },
  neem: {
    inci: "Melia Azadirachta Leaf Extract",
    scentProfile: "Green, bitter, protective",
    extraNotes: "A traditional Indian botanical used for a clean skin-care character.",
    ...FACE,
  },
  "shea-butter": {
    inci: "Butyrospermum Parkii (Shea) Butter",
    scentProfile: "Warm, faintly nutty, creamy",
    extraNotes: "A rich emollient for dry skin, lips, and body butters.",
    ...BODY,
  },
  sandalwood: {
    inci: "Santalum Album Oil",
    scentProfile: "Creamy wood, quiet warmth",
    extraNotes: "A classic incense and perfume heart note.",
    ...HOME,
  },
  jasmine: {
    inci: "Jasminum Grandiflorum Flower Extract",
    scentProfile: "Lush white floral, evening",
    extraNotes: "Used sparingly in incense, perfume, and rich florals.",
    ...HOME,
  },
  turmeric: {
    inci: "Curcuma Longa Root Extract",
    scentProfile: "Warm, earthy, golden spice",
    extraNotes: "A bright botanical for comforting skin rituals.",
    ...FACE,
  },
  "tea-tree": {
    inci: "Melaleuca Alternifolia Leaf Oil",
    scentProfile: "Sharp, medicinal-green, clarifying",
    extraNotes: "Used in clean, fresh cleansing formulas.",
    ...FACE,
  },
  vetiver: {
    inci: "Vetiveria Zizanoides Root Oil",
    scentProfile: "Deep earth, dry root, lasting",
    extraNotes: "Anchors incense and perfume bases.",
    ...HOME,
  },
  rose: {
    inci: "Rosa Damascena Flower Oil",
    scentProfile: "Classic rose, honeyed floral",
    extraNotes: "A heart note for body mists, incense, and skin care.",
    ...FACE,
  },
  jojoba: {
    inci: "Simmondsia Chinensis (Jojoba) Seed Oil",
    scentProfile: "Almost neutral, softly oily",
    extraNotes: "A light, skin-close oil that softens without a heavy film.",
    ...FACE,
  },
  olive: {
    inci: "Olea Europaea (Olive) Fruit Oil",
    scentProfile: "Mild, green, familiar",
    extraNotes: "A nourishing soap and body-care base.",
    ...BODY,
  },
  hibiscus: {
    inci: "Hibiscus Sabdariffa Flower Extract",
    scentProfile: "Tart floral, tea-like",
    extraNotes: "Used to tone and refresh hair and body rituals.",
    ...HAIR,
  },
  peppermint: {
    inci: "Mentha Piperita Oil",
    scentProfile: "Cool, waking mint",
    extraNotes: "A fresh lift for skin, scalp, and space.",
    ...BODY,
  },
  patchouli: {
    inci: "Pogostemon Cablin Oil",
    scentProfile: "Earthy, lingering, resinous",
    extraNotes: "Adds depth to incense and perfume blends.",
    ...HOME,
  },
  "ylang-ylang": {
    inci: "Cananga Odorata Flower Oil",
    scentProfile: "Rich floral, creamy, sweet",
    extraNotes: "Softens and sweetens perfume and incense hearts.",
    ...PERFUME,
  },
  rosemary: {
    inci: "Rosmarinus Officinalis Leaf Oil",
    scentProfile: "Camphoraceous herbal, clean",
    extraNotes: "A classic hair and body herbal note.",
    ...HAIR,
  },
  cucumber: {
    inci: "Cucumis Sativus Fruit Extract",
    scentProfile: "Cool, watery, green",
    extraNotes: "Used in under-eye and refreshing face care.",
    ...FACE,
  },
  "water-lily": {
    inci: "Nymphaea Alba Flower Extract",
    scentProfile: "Quiet aquatic floral",
    extraNotes: "A cool, pond-fresh softness in face and body care.",
    ...FACE,
  },
  beeswax: {
    inci: "Cera Alba",
    scentProfile: "Warm honey-wax",
    extraNotes: "Gives lip balms and solids their structure.",
    ...FACE,
  },
};

export function extraForIngredientSlug(slug: string): IngredientExtra {
  return INGREDIENT_EXTRAS[slug] ?? {};
}
