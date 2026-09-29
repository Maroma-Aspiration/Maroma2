const STOP = new Set([
  "oil",
  "oils",
  "extract",
  "essential",
  "organic",
  "himalayan",
  "indian",
  "flower",
  "resin",
  "butter",
  "the",
  "and",
  "for",
]);

const FILES: Array<{ file: string; keys: string[] }> = [
  { file: "ajowain.webp", keys: ["ajowain", "ajwain", "ajowan"] },
  { file: "almond.webp", keys: ["almond"] },
  { file: "aloe.webp", keys: ["aloe", "aloe vera"] },
  { file: "apricot.webp", keys: ["apricot"] },
  { file: "arrow root.webp", keys: ["arrow root", "arrowroot"] },
  { file: "avocado.webp", keys: ["avocado"] },
  { file: "basil.webp", keys: ["basil"] },
  { file: "beeswax.png", keys: ["beeswax"] },
  { file: "bergamot.webp", keys: ["bergamot"] },
  { file: "bicarbonate.webp", keys: ["bicarbonate"] },
  { file: "black clay.webp", keys: ["black clay"] },
  { file: "calendula.webp", keys: ["calendula"] },
  { file: "cedarwood.webp", keys: ["cedarwood", "himalayan cedarwood", "himalayan cedarwood oil"] },
  { file: "charcoal.webp", keys: ["charcoal", "bamboo charcoal"] },
  { file: "citrus-lemon-lime.webp", keys: ["citrus", "lime"] },
  { file: "cocoa.webp", keys: ["cocoa", "cocoa butter"] },
  { file: "coconut.webp", keys: ["coconut", "coconut oil"] },
  { file: "corn-flour.webp", keys: ["corn flour", "cornflour"] },
  { file: "plant-collagen.webp", keys: ["plant collagen", "collagen"] },
  { file: "aha-fruit-acid.webp", keys: ["aha", "aha fruit acid", "fruit acid"] },
  { file: "rice-bran.webp", keys: ["rice bran", "rice bran oil"] },
  { file: "coffee.webp", keys: ["coffee"] },
  { file: "cypress.webp", keys: ["cypress"] },
  { file: "fenugreek.webp", keys: ["fenugreek"] },
  { file: "geranium.webp", keys: ["geranium"] },
  { file: "grapefruit.webp", keys: ["grapefruit"] },
  { file: "grapeseed.webp", keys: ["grapeseed", "grape seed"] },
  { file: "henna.webp", keys: ["henna"] },
  { file: "hibiscus flower.webp", keys: ["hibiscus"] },
  { file: "hyaluronic.png", keys: ["hyaluronic", "hyaluronic acid"] },
  { file: "indian barberry.webp", keys: ["barberry", "indian barberry"] },
  { file: "jasmine.webp", keys: ["jasmine"] },
  { file: "jojoba.webp", keys: ["jojoba"] },
  { file: "kaolin clay.webp", keys: ["kaolin", "kaolin clay"] },
  { file: "kokum.webp", keys: ["kokum", "kokum butter"] },
  { file: "lavender.webp", keys: ["lavender", "lavandin", "lavandin oil"] },
  { file: "lemon.webp", keys: ["lemon", "lemon oil"] },
  { file: "lemongrass.webp", keys: ["lemongrass", "lemongrass butter", "ginger grass"] },
  { file: "licorice.webp", keys: ["licorice", "liquorice"] },
  { file: "mandarin.webp", keys: ["mandarin"] },
  { file: "mango.webp", keys: ["mango", "mango butter"] },
  { file: "moringa.webp", keys: ["moringa"] },
  { file: "neem.webp", keys: ["neem"] },
  { file: "neem oil.webp", keys: ["neem oil"] },
  { file: "olibanum_resin.webp", keys: ["olibanum", "frankincense"] },
  { file: "olive.webp", keys: ["olive"] },
  { file: "orange.webp", keys: ["orange", "bitter orange", "sweet orange"] },
  { file: "palmarosa.webp", keys: ["palmarosa"] },
  { file: "patchouli.webp", keys: ["patchouli"] },
  { file: "peppermint.webp", keys: ["peppermint", "peppermint oil", "mint", "spearmint"] },
  { file: "petitgrain.webp", keys: ["petitgrain"] },
  { file: "pomegranate.webp", keys: ["pomegranate"] },
  { file: "quinoa.webp", keys: ["quinoa"] },
  { file: "rose.webp", keys: ["rose", "rose absolute", "rose water"] },
  { file: "rosehip.webp", keys: ["rosehip", "rose hip"] },
  { file: "rosemary.webp", keys: ["rosemary"] },
  { file: "sandalwood.webp", keys: ["sandalwood"] },
  { file: "sesame oil.webp", keys: ["sesame oil"] },
  { file: "sesame.png", keys: ["sesame"] },
  { file: "shatavari.webp", keys: ["shatavari"] },
  { file: "shea butter.webp", keys: ["shea", "shea butter"] },
  { file: "teatree.webp", keys: ["tea tree", "teatree"] },
  { file: "tonka bean.webp", keys: ["tonka", "tonka bean"] },
  { file: "turmeric.webp", keys: ["turmeric"] },
  { file: "vanilla.png", keys: ["vanilla"] },
  { file: "vetiver.webp", keys: ["vetiver", "vetiver oil", "vetiver root powder"] },
  { file: "water lily.webp", keys: ["water lily"] },
  { file: "ylang ylang.webp", keys: ["ylang ylang", "ylang", "cananga"] },
  { file: "allantoin.png", keys: ["allantoin"] },
  { file: "amla.png", keys: ["amla"] },
  { file: "amyris.png", keys: ["amyris"] },
  { file: "arnica.png", keys: ["arnica"] },
  { file: "ashwagandha.png", keys: ["ashwagandha"] },
  { file: "bakuchiol.png", keys: ["bakuchiol", "bukachiol"] },
  { file: "bearberry.png", keys: ["bearberry"] },
  { file: "bengal-gram.png", keys: ["bengal gram"] },
  { file: "benzoin.png", keys: ["benzoin"] },
  { file: "bhumyamlaki.png", keys: ["bhumyamlaki"] },
  { file: "black-pepper.png", keys: ["black pepper", "blackpepper"] },
  { file: "brahmi.png", keys: ["brahmi"] },
  { file: "bringaraj.png", keys: ["bringaraj", "bhringraj"] },
  { file: "cardamom.png", keys: ["cardamom"] },
  { file: "castor.png", keys: ["castor"] },
  { file: "chamomile.png", keys: ["chamomile"] },
  { file: "cinnamon.png", keys: ["cinnamon", "cassia"] },
  { file: "clary-sage.png", keys: ["clary sage"] },
  { file: "clove.png", keys: ["clove"] },
  { file: "copaiba.png", keys: ["copaiba", "balsam copaiba"] },
  { file: "cubeb.png", keys: ["cubeb"] },
  { file: "cucumber.png", keys: ["cucumber"] },
  { file: "cypriol.png", keys: ["cypriol", "nagarmotha"] },
  { file: "elemi.png", keys: ["elemi"] },
  { file: "epsom-salt.png", keys: ["epsom salt", "glauber s salt", "glaubers salt"] },
  { file: "eucalyptus.png", keys: ["eucalyptus"] },
  { file: "flaxseed.png", keys: ["flaxseed", "flax seed"] },
  { file: "galbanum.png", keys: ["galbanum", "galbanum resin"] },
  { file: "ginger.png", keys: ["ginger"] },
  { file: "glycerine.png", keys: ["glycerine", "glycerin"] },
  { file: "guaiac-wood.png", keys: ["guaiac wood", "guaiac"] },
  { file: "indian-borage.png", keys: ["indian borage", "borage"] },
  { file: "indian-tulsi.png", keys: ["indian tulsi", "tulsi"] },
  { file: "juniper-berry.png", keys: ["juniper berry", "juniper"] },
  { file: "labdanum.png", keys: ["labdanum", "rockrose"] },
  { file: "lupine.png", keys: ["lupine", "lupine peptides"] },
  { file: "manjistha.png", keys: ["manjistha"] },
  { file: "masikai.png", keys: ["masikai"] },
  { file: "multani-mitti.png", keys: ["multani mitti"] },
  { file: "myrrh.png", keys: ["myrrh"] },
  { file: "natural-vinegar.png", keys: ["natural vinegar", "vinegar"] },
  { file: "neroli.png", keys: ["neroli"] },
  { file: "niacinamide.png", keys: ["niacinamide"] },
  { file: "nutmeg.png", keys: ["nutmeg"] },
  { file: "oakmoss.png", keys: ["oakmoss", "oak moss"] },
  { file: "oats.png", keys: ["oats", "oat"] },
  { file: "oregano.png", keys: ["oregano"] },
  { file: "panthenol.png", keys: ["panthenol"] },
  { file: "peptides.png", keys: ["peptides"] },
  { file: "pine.png", keys: ["pine"] },
  { file: "poppy.png", keys: ["poppy"] },
  { file: "pro-ceramides.png", keys: ["pro ceramides", "ceramides"] },
  { file: "retinol.png", keys: ["retinol", "retinol vitamin a", "vitamin a"] },
  { file: "rosewood.png", keys: ["rosewood", "shiu"] },
  { file: "saffron.png", keys: ["saffron"] },
  { file: "spikenard.png", keys: ["spikenard"] },
  { file: "spirulina.png", keys: ["spirulina"] },
  { file: "styrax.png", keys: ["styrax"] },
  { file: "sunflower.png", keys: ["sunflower"] },
  { file: "vitamin-b.png", keys: ["vitamin b"] },
  { file: "vitamin-e.png", keys: ["vitamin e", "tocopherol"] },
  { file: "walnut.png", keys: ["walnut"] },
  { file: "wheatgerm.png", keys: ["wheatgerm", "wheat germ"] },
  { file: "zinc-oxide.png", keys: ["zinc oxide", "zincoxide", "zinc ricinoleate"] },
];

const NOTES: Record<string, string> = {
  "aloe vera": "Aloe vera is used to cool and comfort skin, leaving it feeling hydrated and settled.",
  aloe: "Aloe vera is used to cool and comfort skin, leaving it feeling hydrated and settled.",
  cedarwood: "Himalayan cedarwood brings a dry, woody aroma often used to ground a blend and freshen a space.",
  "himalayan cedarwood": "Himalayan cedarwood brings a dry, woody aroma often used to ground a blend and freshen a space.",
  coconut: "Coconut oil is a familiar Maroma base: soft, nourishing, and used to carry botanical scent onto skin.",
  geranium: "Geranium adds a green-floral note and is often chosen to balance a blend and leave skin feeling refreshed.",
  lavender: "Lavender and lavandin lend a clean, calming floral scent used across Maroma body and home rituals.",
  lavandin: "Lavandin is a bright lavender-family oil used for a clean, herbal-floral freshness.",
  neem: "Neem is a classic Indian botanical, used here for its clean, protective character on skin and in natural care blends.",
  "neem oil": "Neem oil is used for its clean, protective character in Maroma's natural care blends.",
  vetiver: "Vetiver has a deep, earthy scent that anchors a fragrance and leaves a lasting, grounded finish.",
  lemon: "Lemon brightens a formula with a crisp citrus lift.",
  hibiscus: "Hibiscus is used to tone and refresh, especially in hair and body rituals.",
  shea: "Shea butter is a rich emollient that helps skin feel soft and cared for.",
  "shea butter": "Shea butter is a rich emollient that helps skin feel soft and cared for.",
  cocoa: "Cocoa butter is a dense, comforting butter used to soften and nourish dry skin.",
  "tonka bean": "Tonka bean adds a warm, softly sweet note that rounds out woody and citrus blends.",
  sandalwood: "Sandalwood is used for its creamy, woody scent and a sense of quiet warmth.",
  rose: "Rose brings a classic floral heart to body and home fragrances.",
  peppermint: "Peppermint adds a cool, waking freshness to skin and space.",
  moringa: "Moringa is used for its light, nourishing feel in hair and body care.",
  jojoba: "Jojoba is a light, skin-close oil used to soften without a heavy finish.",
  olive: "Olive oil is a familiar nourishing base in soaps and body care.",
  charcoal: "Bamboo charcoal is used in cleansing formulas to leave skin feeling fresh and clarified.",
  turmeric: "Turmeric is a golden botanical used for a bright, comforting skin ritual.",
  patchouli: "Patchouli adds an earthy, lingering depth to fragrance blends.",
  ylang: "Ylang ylang is a rich floral used to soften and sweeten a blend.",
  "ylang ylang": "Ylang ylang is a rich floral used to soften and sweeten a blend.",
  olibanum: "Olibanum (frankincense resin) adds a resinous, meditative warmth.",
  frankincense: "Olibanum (frankincense resin) adds a resinous, meditative warmth.",
  petitgrain: "Petitgrain is a green-citrus leaf oil that keeps a blend fresh and lifted.",
  lemongrass: "Lemongrass brings a bright, lemony-herbal snap to body and home care.",
  rosemary: "Rosemary is a clean herbal note often used in hair and body rituals.",
  jasmine: "Jasmine is a lush floral used sparingly for a soft, evening scent.",
  calendula: "Calendula is a gentle flower used in soothing skin-care rituals.",
  almond: "Sweet almond oil is a light, softening base for body care.",
  mango: "Mango butter is a creamy emollient used to soften dry skin.",
  pomegranate: "Pomegranate is used for a tart, bright botanical character in skin care.",
  "tea tree": "Tea tree is a sharp, clarifying botanical used in clean, fresh formulas.",
  teatree: "Tea tree is a sharp, clarifying botanical used in clean, fresh formulas.",
};

export function normalizeKeyIngredientName(name: string): string {
  return String(name || "")
    .replace(/&amp;/gi, "and")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fileUrl(file: string): string {
  return encodeURI(`/key-ingredients/${file}`);
}

export function resolveKeyIngredientImage(name: string): string {
  const normalized = normalizeKeyIngredientName(name);
  if (!normalized) return "";

  for (const entry of FILES) {
    if (entry.keys.includes(normalized)) return fileUrl(entry.file);
  }

  const stripped = normalized
    .split(" ")
    .filter((part) => !STOP.has(part))
    .join(" ")
    .trim();

  if (stripped && stripped !== normalized) {
    for (const entry of FILES) {
      if (entry.keys.includes(stripped)) return fileUrl(entry.file);
    }
  }

  for (const entry of FILES) {
    if (entry.keys.some((key) => normalized.includes(key) || key.includes(normalized))) {
      return fileUrl(entry.file);
    }
    if (stripped && entry.keys.some((key) => stripped.includes(key) || key.includes(stripped))) {
      return fileUrl(entry.file);
    }
  }

  return "";
}

function noteFor(name: string): string {
  const normalized = normalizeKeyIngredientName(name);
  if (NOTES[normalized]) return NOTES[normalized];
  const stripped = normalized
    .split(" ")
    .filter((part) => !STOP.has(part))
    .join(" ")
    .trim();
  return NOTES[stripped] || "";
}

function extractMention(copy: string, name: string): string {
  const haystack = String(copy || "").replace(/\s+/g, " ").trim();
  if (!haystack) return "";
  const needles = [name, ...normalizeKeyIngredientName(name).split(" ").filter((part) => part.length > 3 && !STOP.has(part))];
  const sentences = haystack.split(/(?<=[.!?])\s+/);
  return (
    sentences.find((sentence) =>
      needles.some((needle) => sentence.toLowerCase().includes(needle.toLowerCase()))
    ) || ""
  );
}

export function resolveKeyIngredientDetail(name: string, productCopy: string): string {
  const mention = extractMention(productCopy, name);
  const note = noteFor(name);
  if (mention && note) {
    if (mention.toLowerCase().includes(note.slice(0, 22).toLowerCase())) return mention;
    return `${mention} ${note}`;
  }
  return mention || note || `${name} is a key botanical in this Maroma formula.`;
}
