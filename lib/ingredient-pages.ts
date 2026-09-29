import { extraForIngredientSlug } from "./ingredient-extras";
import { normalizeKeyIngredientName, resolveKeyIngredientImage } from "./key-ingredient-media";
import type { ProductRecord } from "./product-types";

export type IngredientPageContent = {
  slug: string;
  name: string;
  aliases: string[];
  description: string;
  benefits: string[];
  imageUrl: string;
  inci: string;
  scentProfile: string;
  extraNotes: string;
  rangeLabel: string;
  rangeHref: string;
};

type IngredientDraft = {
  slug: string;
  name: string;
  aliases?: string[];
  description: string;
  benefits: string[];
};

const DRAFTS: IngredientDraft[] = [
  {
    slug: "ajowan",
    name: "Ajowan",
    aliases: ["Ajowain", "Ajwain"],
    description:
      "Ajowan (also called ajwain) is a small, warm seed with a thyme-like, slightly peppery scent. In Maroma formulas it adds a bright kitchen-herb character that feels clean, familiar, and a little spicy.",
    benefits: [
      "Lifts a blend with a warm, herbal snap",
      "Pairs well with citrus, woods, and other kitchen botanicals",
      "Gives cleansing and home-care formulas a fresh, lived-in aroma",
    ],
  },
  {
    slug: "aloe-vera",
    name: "Aloe Vera",
    aliases: ["Aloe"],
    description:
      "Aloe vera is the cooling inner leaf gel used across Maroma body and hair care. It feels light, watery, and calming on skin that is warm, dry, or easily unsettled.",
    benefits: [
      "Cools and comforts after sun, heat, or daily washing",
      "Helps skin feel hydrated without a heavy film",
      "Softens the finish of gels, sprays, and lotions",
    ],
  },
  {
    slug: "almond",
    name: "Almond",
    description:
      "Sweet almond oil is a pale, fine oil used as a softening base in soaps and body care. It spreads easily and leaves skin feeling supple rather than greasy.",
    benefits: [
      "Softens dry or tight-feeling skin",
      "Carries botanical scent close to the skin",
      "Gives soaps and oils a smooth, comfortable slip",
    ],
  },
  {
    slug: "amla",
    name: "Amla",
    description:
      "Amla is the Indian gooseberry used in traditional hair rituals. Maroma uses it for its tart, strengthening character in shampoos and scalp care.",
    benefits: [
      "Supports a clean, refreshed scalp feel",
      "Often chosen for hair that needs bounce and softness",
      "Adds a bright, botanical note to hair formulas",
    ],
  },
  {
    slug: "apricot",
    name: "Apricot",
    description:
      "Apricot kernel oil is a light, peachy oil used to soften skin. It absorbs quickly and suits face and body formulas that should not feel heavy.",
    benefits: [
      "Leaves skin feeling smooth and comfortable",
      "A lighter alternative to richer butters",
      "Works well in everyday moisturisers and oils",
    ],
  },
  {
    slug: "avocado",
    name: "Avocado",
    description:
      "Avocado oil is a richer, green oil used when skin needs a more cushioned feel. It is a natural fit for body butters and dry-skin care.",
    benefits: [
      "Nourishes dry or weather-worn skin",
      "Adds a creamy, comfortable afterfeel",
      "Supports richer body-care textures",
    ],
  },
  {
    slug: "basil",
    name: "Basil",
    description:
      "Basil is a green, slightly spicy herb oil. In Maroma blends it keeps a fragrance lifted and kitchen-fresh, especially beside citrus and woods.",
    benefits: [
      "Adds a clean herbal brightness",
      "Cuts through heavier floral or woody notes",
      "Suits daytime body and home fragrances",
    ],
  },
  {
    slug: "bergamot",
    name: "Bergamot",
    description:
      "Bergamot is the citrus peel behind a classic eau-de-cologne sparkle: bitter-orange, a little floral, and very fresh. It opens many Maroma blends.",
    benefits: [
      "Gives a blend an immediate, sunny lift",
      "Softens woody or spicy notes without turning sweet",
      "A familiar, elegant citrus for skin and space",
    ],
  },
  {
    slug: "calendula",
    name: "Calendula",
    description:
      "Calendula is the pot marigold used in gentle skin rituals. Maroma turns to it when a formula should feel kind, familiar, and soothing.",
    benefits: [
      "Comforts skin that feels dry or easily irritated",
      "A traditional flower for everyday care",
      "Fits baby, face, and after-sun style formulas",
    ],
  },
  {
    slug: "himalayan-cedarwood",
    name: "Himalayan Cedarwood",
    aliases: ["Cedarwood", "Himalayan Cedarwood Oil"],
    description:
      "Himalayan cedarwood is a dry, pencil-shaving wood with a quiet, forest-floor depth. It grounds Colibri and other Maroma blends and is also used for its naturally freshening character.",
    benefits: [
      "Anchors a fragrance so it lasts and feels settled",
      "Adds a clean woody note without heaviness",
      "Used in body sprays and sachets for a fresh, protected feeling",
    ],
  },
  {
    slug: "coconut",
    name: "Coconut",
    aliases: ["Coconut Oil"],
    description:
      "Coconut oil is one of Maroma's most familiar bases: soft, tropical, and used to carry scent and comfort onto skin. It appears in soaps, butters, and hair care.",
    benefits: [
      "Softens and conditions skin and hair",
      "A stable, plant-based carrier for essential oils",
      "Leaves a comforting, recognisable finish",
    ],
  },
  {
    slug: "geranium",
    name: "Geranium",
    description:
      "Geranium is a green-rose floral used to balance a blend. It sits between herb and flower, which is why it works in both skin care and home fragrance.",
    benefits: [
      "Refreshes skin-care formulas with a clean floral note",
      "Helps a blend feel complete rather than sharp or sweet",
      "A classic companion to woods, citrus, and rose",
    ],
  },
  {
    slug: "neem",
    name: "Neem",
    aliases: ["Neem Oil"],
    description:
      "Neem is a bitter, green Indian tree used for its clean, protective character. In Maroma body sprays and care products it supports a fresh, cared-for feel.",
    benefits: [
      "Used in natural protective and outdoor formulas",
      "Helps skin feel soothed after daily exposure",
      "Adds an authentic botanical backbone to a blend",
    ],
  },
  {
    slug: "vetiver",
    name: "Vetiver",
    aliases: ["Vetiver Oil", "Vetiver Root Powder"],
    description:
      "Vetiver is a deep, smoky-earthy root from tropical grasses. It is the quiet bass note in many Maroma fragrances: dry, lasting, and grounding.",
    benefits: [
      "Gives a fragrance a long, earthy finish",
      "Balances bright citrus and florals",
      "A classic note for evening and men's blends",
    ],
  },
  {
    slug: "lavender",
    name: "Lavender",
    aliases: ["Lavandin", "Lavandin Oil"],
    description:
      "Lavender and its cousin lavandin are clean, herbal florals. Maroma uses them for rest, freshness, and that washed-linen feeling across body and home care.",
    benefits: [
      "Calms the character of a room or a ritual",
      "Leaves skin and linens smelling clean",
      "A versatile note from soap to sachet",
    ],
  },
  {
    slug: "lemon",
    name: "Lemon",
    aliases: ["Lemon OIl", "Lemon Oil"],
    description:
      "Lemon peel oil is a sharp, sunny citrus. It brightens soaps, sprays, and home fragrance the moment they open.",
    benefits: [
      "Adds instant freshness",
      "Cuts through richer oils and butters",
      "A familiar, uplifting everyday citrus",
    ],
  },
  {
    slug: "lemongrass",
    name: "Lemongrass",
    aliases: ["Lemongrass Butter"],
    description:
      "Lemongrass is a tall tropical grass with a lemony, slightly green scent. It is one of Maroma's most used notes for clean, outdoor freshness.",
    benefits: [
      "Keeps a blend bright and airy",
      "A natural fit for insect-aware and outdoor care",
      "Pairs with mint, cedarwood, and citrus",
    ],
  },
  {
    slug: "hibiscus",
    name: "Hibiscus",
    description:
      "Hibiscus is the deep-pink flower used in Maroma hair and body rituals. It has a gently tart, toning character and a soft floral scent.",
    benefits: [
      "Used to refresh hair and scalp formulas",
      "Helps skin feel smoothed and refined",
      "Adds a distinctive botanical colour and story",
    ],
  },
  {
    slug: "shea-butter",
    name: "Shea Butter",
    description:
      "Shea butter is a rich West African butter that melts into dry skin. Maroma uses it in body butters and creams when comfort is the point.",
    benefits: [
      "Softens very dry or rough skin",
      "Gives creams a cushioned, lasting feel",
      "A plant butter that stays comfortable, not waxy",
    ],
  },
  {
    slug: "cocoa-butter",
    name: "Cocoa Butter",
    aliases: ["Cocoa"],
    description:
      "Cocoa butter is the dense, chocolate-scented butter from the cacao bean. It is used to enrich body butters and leave skin feeling cared for.",
    benefits: [
      "Nourishes dry patches and winter skin",
      "Adds a warm, comforting scent to a formula",
      "Helps richer textures feel luxurious",
    ],
  },
  {
    slug: "tonka-bean",
    name: "Tonka Bean",
    description:
      "Tonka bean is a warm, softly sweet note: hay, vanilla, and a hint of tobacco. It rounds woody and citrus blends so they feel finished.",
    benefits: [
      "Softens sharp woods and citrus",
      "Adds a quiet sweetness without turning gourmand",
      "A lasting heart note in men's and home blends",
    ],
  },
  {
    slug: "sandalwood",
    name: "Sandalwood",
    description:
      "Sandalwood is a creamy, milky wood used for warmth and quiet. In Maroma it is chosen for meditative, skin-close fragrances.",
    benefits: [
      "Softens a blend and helps it linger",
      "A classic note for incense and body oils",
      "Feels calm rather than spicy or sharp",
    ],
  },
  {
    slug: "rose",
    name: "Rose",
    aliases: ["Rose Absolute", "Rose Water"],
    description:
      "Rose is the classic floral heart of many Maroma body and home fragrances: petal-soft, a little honeyed, and immediately recognisable.",
    benefits: [
      "Gives a formula an elegant floral centre",
      "Rose water freshens and softens skin-care textures",
      "Works from soap to mist to oil",
    ],
  },
  {
    slug: "peppermint",
    name: "Peppermint",
    aliases: ["Peppermint Oil", "Mint", "Spearmint"],
    description:
      "Peppermint is a cool, waking mint. Maroma uses it when a product should feel fresh on skin or in a room, from foot care to outdoor sprays.",
    benefits: [
      "Adds a clean, cooling sensation",
      "Lifts tired-feeling formulas",
      "A natural companion to lemon, neem, and cedarwood",
    ],
  },
  {
    slug: "moringa",
    name: "Moringa",
    description:
      "Moringa is the drumstick-tree leaf and oil used in Maroma hair and body care. It is light, green, and chosen for everyday nourishment.",
    benefits: [
      "A gentle plant oil for hair and skin",
      "Leaves a soft, non-heavy finish",
      "Supports clean, botanical formulas",
    ],
  },
  {
    slug: "jojoba",
    name: "Jojoba",
    description:
      "Jojoba is a liquid wax that sits close to the skin's own oils. It is used when a formula should soften without shine or heaviness.",
    benefits: [
      "Balances the feel of face and body oils",
      "Absorbs cleanly",
      "A stable carrier for essential oils",
    ],
  },
  {
    slug: "olive",
    name: "Olive",
    description:
      "Olive oil is a classic soap and skin-care base: fruity, green, and deeply familiar. It gives Maroma soaps their comfortable, washed-soft finish.",
    benefits: [
      "Cleanses without a stripped feeling",
      "Softens hands and body after washing",
      "A time-tested plant oil for daily care",
    ],
  },
  {
    slug: "bamboo-charcoal",
    name: "Bamboo Charcoal",
    aliases: ["Activated Bamboo Charcoal", "Charcoal"],
    description:
      "Bamboo charcoal is a fine, dark powder used in cleansing formulas. It leaves skin feeling freshly washed and clarified.",
    benefits: [
      "Helps wash away the day's residue",
      "Gives scrubs and soaps a clean, matte finish",
      "A simple, mineral-like cleanser in botanical care",
    ],
  },
  {
    slug: "turmeric",
    name: "Turmeric",
    description:
      "Turmeric is the golden kitchen rhizome used in Maroma skin rituals. It has a warm, earthy scent and a bright, comforting colour.",
    benefits: [
      "A traditional botanical for glowing-feeling skin",
      "Adds warmth to face and body masks",
      "Pairs with sandalwood, neem, and citrus",
    ],
  },
  {
    slug: "patchouli",
    name: "Patchouli",
    description:
      "Patchouli is an earthy, lingering leaf oil. It gives depth to incense, oils, and evening blends without needing sweetness.",
    benefits: [
      "Makes a fragrance last",
      "Grounds florals and citruses",
      "A signature note of natural perfume",
    ],
  },
  {
    slug: "ylang-ylang",
    name: "Ylang Ylang",
    aliases: ["Cananga"],
    description:
      "Ylang ylang is a rich, banana-floral blossom from the cananga tree. A little goes a long way: it softens and sweetens a blend.",
    benefits: [
      "Rounds sharp or woody formulas",
      "Adds a tropical floral heart",
      "Used sparingly so the blend stays elegant",
    ],
  },
  {
    slug: "frankincense",
    name: "Frankincense",
    aliases: ["Olibanum"],
    description:
      "Frankincense (olibanum) is a resin with a church-quiet, lemony-wood scent. Maroma uses it for meditative home and body blends.",
    benefits: [
      "Adds resinous warmth and lift",
      "A classic incense and ritual note",
      "Helps a space feel still and open",
    ],
  },
  {
    slug: "petitgrain",
    name: "Petitgrain",
    aliases: ["Bitter Orange"],
    description:
      "Petitgrain is distilled from the leaves of the bitter orange tree. It is greener and less sweet than the peel, and keeps a blend fresh.",
    benefits: [
      "A clean, leafy citrus note",
      "Bridges bergamot, neroli, and woods",
      "Suits cologne-style body care",
    ],
  },
  {
    slug: "rosemary",
    name: "Rosemary",
    description:
      "Rosemary is a camphor-green herb used in hair and body rituals. It smells like a Mediterranean garden after rain.",
    benefits: [
      "Freshens the scalp and hair-care formulas",
      "Adds a waking herbal note",
      "Pairs with mint, lemon, and cedarwood",
    ],
  },
  {
    slug: "jasmine",
    name: "Jasmine",
    description:
      "Jasmine is a lush, night-blooming floral. Maroma uses it as a precious heart note in finer body and home fragrances.",
    benefits: [
      "Gives a blend a sensual, evening character",
      "Softens citrus and woods",
      "A little transforms the whole formula",
    ],
  },
  {
    slug: "mango-butter",
    name: "Mango Butter",
    aliases: ["Mango"],
    description:
      "Mango butter is a creamy, pale butter from the mango kernel. It melts into dry skin with a lighter feel than shea.",
    benefits: [
      "Softens without a heavy residue",
      "A good everyday body-butter base",
      "Comforts dry elbows, hands, and legs",
    ],
  },
  {
    slug: "pomegranate",
    name: "Pomegranate",
    description:
      "Pomegranate seed oil and extract add a tart, jewel-toned botanical character to Maroma skin care.",
    benefits: [
      "A light, fast-absorbing plant oil",
      "Used in brightening, fresh-feeling formulas",
      "Adds a distinctive fruit-seed story",
    ],
  },
  {
    slug: "tea-tree",
    name: "Tea Tree",
    description:
      "Tea tree is a sharp, medicinal-fresh leaf oil. It is used when a formula should feel clarifying and extra clean.",
    benefits: [
      "Supports a freshly washed feeling",
      "A natural fit for blemish-prone or oily skin care",
      "Cuts through heavier notes in a blend",
    ],
  },
  {
    slug: "beeswax",
    name: "Beeswax",
    aliases: ["Beewax", "Wax"],
    description:
      "Beeswax is used in balms and some richer textures to hold oils together and leave a soft, protective finish.",
    benefits: [
      "Gives balms their shape and stay",
      "Helps moisture linger on skin",
      "A traditional craft ingredient in small-batch care",
    ],
  },
  {
    slug: "kaolin",
    name: "Kaolin",
    aliases: ["Kaolin Clay", "White Clay"],
    description:
      "Kaolin is a fine white clay used in masks and cleansers. It is gentler than stronger clays and leaves skin feeling smooth.",
    benefits: [
      "Draws out daily residue without a tight feel",
      "Softens the texture of masks and soaps",
      "Suits sensitive or dry-leaning skin better than harsher clays",
    ],
  },
  {
    slug: "black-clay",
    name: "Black Clay",
    description:
      "Black clay is a mineral-rich clay used for a deeper cleanse. It is chosen for formulas that should leave skin feeling reset.",
    benefits: [
      "A thorough, spa-like cleanse",
      "Gives masks a satisfying, earthy texture",
      "Used when skin needs a clearer finish",
    ],
  },
  {
    slug: "sesame",
    name: "Sesame",
    aliases: ["Sesame Oil"],
    description:
      "Sesame oil is a warm, nutty oil used in traditional Indian body rituals. Maroma uses it as a nourishing carrier.",
    benefits: [
      "Softens and conditions skin",
      "A classic oil for massage and daily anointing",
      "Carries spice and wood notes beautifully",
    ],
  },
  {
    slug: "shatavari",
    name: "Shatavari",
    description:
      "Shatavari is a traditional Ayurvedic root used in Maroma care for its gentle, nourishing character.",
    benefits: [
      "Chosen for comforting, everyday skin rituals",
      "Adds an authentic Indian herbal story",
      "Fits calming body and wellness-leaning formulas",
    ],
  },
  {
    slug: "henna",
    name: "Henna",
    aliases: ["Henna Leaf"],
    description:
      "Henna leaf is used in hair rituals for its cooling, conditioning character. Maroma uses it as a botanical, not as a dye story on the shop.",
    benefits: [
      "Supports a refreshed scalp feel",
      "A traditional companion to amla and hibiscus",
      "Adds a green, herbal note to hair care",
    ],
  },
  {
    slug: "coffee",
    name: "Coffee",
    aliases: ["Organic Coffee"],
    description:
      "Coffee is used as a warm, roasted botanical in scrubs and body care. It smells familiar and feels gently stimulating in a morning ritual.",
    benefits: [
      "Gives scrubs a pleasant grain and scent",
      "A waking, everyday aroma",
      "Pairs with cocoa, vanilla, and citrus",
    ],
  },
  {
    slug: "grapefruit",
    name: "Grapefruit",
    aliases: ["GRAPEFRUIT"],
    description:
      "Grapefruit peel oil is a bitter-sweet citrus with a pink, sparkling top. It keeps body care feeling light and shower-fresh.",
    benefits: [
      "Opens a blend with a juicy citrus flash",
      "A natural fit for morning gels and soaps",
      "Balances creamy butters and woods",
    ],
  },
  {
    slug: "grapeseed",
    name: "Grapeseed",
    description:
      "Grapeseed oil is a very light, almost dry oil. It is used when a formula should soften skin and then disappear.",
    benefits: [
      "A fast-absorbing daily oil",
      "Suits combination or warmer climates",
      "A quiet carrier that does not mask other botanicals",
    ],
  },
  {
    slug: "orange",
    name: "Orange",
    aliases: ["Sweet Orange"],
    description:
      "Sweet orange peel is a cheerful, juicy citrus used throughout Maroma soaps, sprays, and home fragrance.",
    benefits: [
      "Makes a formula feel friendly and bright",
      "A familiar scent for family bathrooms",
      "Softens spice and wood notes",
    ],
  },
  {
    slug: "lime",
    name: "Lime",
    aliases: ["Citrus"],
    description:
      "Lime is a sharper, greener citrus than lemon. It is used for a zestier, almost sparkling freshness.",
    benefits: [
      "Adds a tart, clean opening",
      "Suits tropical and outdoor blends",
      "Lifts heavier oils",
    ],
  },
  {
    slug: "mandarin",
    name: "Mandarin",
    aliases: ["Mandarine"],
    description:
      "Mandarin is a sweeter, softer citrus than orange. It is often chosen for gentler body and home blends.",
    benefits: [
      "A kinder citrus for sensitive noses",
      "Adds a sunny, slightly floral peel note",
      "Works in both day and evening formulas",
    ],
  },
  {
    slug: "palmarosa",
    name: "Palmarosa",
    description:
      "Palmarosa is a grassy, rose-like oil from a tropical grass. It is used to give florals a fresh, green lift.",
    benefits: [
      "A lighter alternative to rose in some blends",
      "Keeps floral formulas from feeling powdery",
      "Suits skin-care mists and oils",
    ],
  },
  {
    slug: "cypress",
    name: "Cypress",
    description:
      "Cypress is a dry, pine-like evergreen. It adds outdoor air to men's blends, sachets, and home fragrance.",
    benefits: [
      "A clean forest note",
      "Freshens closets and rooms",
      "Pairs with cedarwood, lemon, and herbs",
    ],
  },
  {
    slug: "fenugreek",
    name: "Fenugreek",
    description:
      "Fenugreek is a maple-scented kitchen seed used in traditional hair and body care. It has a comforting, slightly sweet herbal character.",
    benefits: [
      "A traditional botanical for hair rituals",
      "Adds warmth to a formula",
      "Sits well with coconut, amla, and sesame",
    ],
  },
  {
    slug: "licorice",
    name: "Licorice",
    aliases: ["Liquorice"],
    description:
      "Licorice root is a sweet, earthy botanical used in some Maroma skin formulas for its soothing character.",
    benefits: [
      "Comforts the feel of a skin-care blend",
      "Adds a soft, familiar herbal note",
      "Used in evening or after-sun style care",
    ],
  },
  {
    slug: "kokum",
    name: "Kokum",
    aliases: ["Kokum Butter"],
    description:
      "Kokum butter is a firm Indian butter that melts at skin temperature. It is used for a non-greasy, powder-soft finish.",
    benefits: [
      "Softens without shine",
      "Helps balms stay stable in warm climates",
      "A lighter Indian alternative to heavier butters",
    ],
  },
  {
    slug: "water-lily",
    name: "Water Lily",
    description:
      "Water lily is a cool, aquatic floral used for a clean, pond-fresh softness in body care.",
    benefits: [
      "Adds a quiet, watery floral note",
      "Suits after-bath and summer formulas",
      "Softens citrus and green blends",
    ],
  },
  {
    slug: "indian-barberry",
    name: "Indian Barberry",
    aliases: ["Barberry"],
    description:
      "Indian barberry (daruharidra) is a traditional Ayurvedic bark and root used in some Maroma skin formulas for its clarifying character.",
    benefits: [
      "Chosen for clean, even-feeling skin rituals",
      "An authentic Indian herbal note",
      "Pairs with turmeric, neem, and clay",
    ],
  },
  {
    slug: "hyaluronic-acid",
    name: "Hyaluronic Acid",
    aliases: ["Hyaluronic acid"],
    description:
      "Hyaluronic acid is a moisture-binding ingredient used in modern Maroma skin care to help skin feel plump and comfortable.",
    benefits: [
      "Helps skin hold onto water",
      "A light, serum-like hydration",
      "Works under oils and creams",
    ],
  },
  {
    slug: "quinoa",
    name: "Quinoa",
    aliases: ["Quiona"],
    description:
      "Quinoa is used as a gentle plant protein and botanical in some hair and body formulas, adding a soft, cereal character.",
    benefits: [
      "Supports a conditioned hair feel",
      "A mild, everyday botanical",
      "Fits clean, modern care textures",
    ],
  },
  {
    slug: "vanilla",
    name: "Vanilla",
    description:
      "Vanilla is a soft, sweet balsam used to warm a blend. Maroma uses it as a background note, not a dessert.",
    benefits: [
      "Rounds spice, wood, and citrus",
      "Makes a fragrance feel closer to the skin",
      "A comforting finish in body care",
    ],
  },
  {
    slug: "rosehip",
    name: "Rosehip",
    aliases: ["Rose Hip"],
    description:
      "Rosehip oil is a dry, orange-tinted oil from the wild rose. It is used in face and body care for a light, nourishing feel.",
    benefits: [
      "A fine oil for nightly skin rituals",
      "Absorbs with little residue",
      "Pairs with rose, jojoba, and pomegranate",
    ],
  },
  {
    slug: "arrowroot",
    name: "Arrowroot",
    aliases: ["Arrow Root"],
    description:
      "Arrowroot is a fine white starch used to soften powders and deodorants so they feel dry and comfortable on skin.",
    benefits: [
      "Gives powders a silky slip",
      "Helps deodorants feel less chalky",
      "A simple plant starch for everyday wear",
    ],
  },
  {
    slug: "baking-soda",
    name: "Baking Soda",
    aliases: ["Sodium Bicarbonate", "Bicarbonate"],
    description:
      "Baking soda is used in some cleansing and deodorant formulas for a fresh, odour-neutral feel.",
    benefits: [
      "Supports a clean, just-washed feeling",
      "A familiar household mineral in natural care",
      "Used in small amounts so skin stays comfortable",
    ],
  },
  {
    slug: "brahmi",
    name: "Brahmi",
    description:
      "Brahmi is a traditional Ayurvedic herb used in Maroma hair and scalp rituals for its cooling, clarifying character.",
    benefits: [
      "A classic herb for scalp care",
      "Pairs with amla, neem, and hibiscus",
      "Adds an authentic South Indian hair-care story",
    ],
  },
  {
    slug: "cardamom",
    name: "Cardamom",
    description:
      "Cardamom is a green, eucalyptus-citrus spice. A little adds lift and a sense of warmth without turning a blend into food.",
    benefits: [
      "Brightens woody and citrus blends",
      "A refined spice for body and home",
      "Familiar from Indian kitchens, used here as perfume",
    ],
  },
  {
    slug: "clove",
    name: "Clove",
    description:
      "Clove is a warm, spicy bud used sparingly. In Maroma it appears in protective and festive blends.",
    benefits: [
      "Adds depth and a hint of spice",
      "Used in sachets and seasonal home care",
      "Best in small amounts beside woods and citrus",
    ],
  },
  {
    slug: "cinnamon",
    name: "Cinnamon",
    aliases: ["Cassia"],
    description:
      "Cinnamon and cassia are warm bark spices. Maroma uses them carefully for a dry, festive heat in home and body blends.",
    benefits: [
      "A comforting winter spice note",
      "Warms vanilla, orange, and wood",
      "Used lightly so the blend stays wearable",
    ],
  },
  {
    slug: "chamomile",
    name: "Chamomile",
    description:
      "Chamomile is an apple-soft flower used when a formula should feel restful and kind to skin.",
    benefits: [
      "A traditional soothing botanical",
      "Suits evening and sensitive-skin care",
      "Pairs with lavender, oats, and calendula",
    ],
  },
  {
    slug: "clary-sage",
    name: "Clary Sage",
    description:
      "Clary sage is a herbal, slightly musky floral. It is used to give blends a calm, skin-close herb character.",
    benefits: [
      "Softens lavender and wood blends",
      "A quiet herbal heart note",
      "Suits evening body oils and mists",
    ],
  },
  {
    slug: "neroli",
    name: "Neroli",
    description:
      "Neroli is orange blossom: honeyed, green, and radiant. It is one of the finer floral notes in Maroma body care.",
    benefits: [
      "An elegant floral-citrus heart",
      "Lifts cologne and evening blends",
      "Pairs with petitgrain, bergamot, and jasmine",
    ],
  },
  {
    slug: "myrrh",
    name: "Myrrh",
    description:
      "Myrrh is a balsamic resin with a bitter-sweet, ancient character. It deepens incense and ritual blends.",
    benefits: [
      "Adds resinous depth beside frankincense",
      "A classic temple and meditation note",
      "Helps a fragrance feel grounded",
    ],
  },
  {
    slug: "benzoin",
    name: "Benzoin",
    description:
      "Benzoin is a vanilla-like resin used to sweeten and fix a blend. It makes woods and spices feel closer to the skin.",
    benefits: [
      "A soft balsamic finish",
      "Helps a fragrance last",
      "Warms citrus and incense notes",
    ],
  },
  {
    slug: "eucalyptus",
    name: "Eucalyptus",
    description:
      "Eucalyptus is a camphor-cool leaf oil. It opens the air in a room and keeps outdoor and linen blends feeling clean.",
    benefits: [
      "A clear, waking freshness",
      "Used in sachets and home care",
      "Pairs with mint, pine, and lemon",
    ],
  },
  {
    slug: "pine",
    name: "Pine",
    description:
      "Pine is a resinous evergreen used for forest-fresh home and body notes.",
    benefits: [
      "A crisp outdoor character",
      "Freshens closets and rooms",
      "Sits well with cypress and cedarwood",
    ],
  },
  {
    slug: "juniper-berry",
    name: "Juniper Berry",
    description:
      "Juniper berry is a gin-bright, peppery evergreen. It keeps men's and outdoor blends dry and lifted.",
    benefits: [
      "A clean, slightly spicy top note",
      "Cuts through heavier woods",
      "Suits cologne and sachet formulas",
    ],
  },
  {
    slug: "castor",
    name: "Castor",
    description:
      "Castor oil is a thick, glossy oil used in soaps and some hair formulas for slip and a conditioned feel.",
    benefits: [
      "Gives soaps a creamy lather",
      "Helps hair-care textures feel richer",
      "A traditional craft oil in small-batch soap",
    ],
  },
  {
    slug: "sunflower",
    name: "Sunflower",
    description:
      "Sunflower oil is a light, everyday carrier. It is used when a formula needs a simple, comfortable plant oil.",
    benefits: [
      "A mild, widely tolerated base oil",
      "Softens without a strong scent of its own",
      "Suits lotions, soaps, and baby-leaning care",
    ],
  },
  {
    slug: "walnut",
    name: "Walnut",
    description:
      "Walnut is used as a fine scrub grain or oil in some Maroma body formulas, for a gentle polish and a nutty softness.",
    benefits: [
      "A natural texture for scrubs",
      "Softens as an oil in richer care",
      "Adds a kitchen-botanical character",
    ],
  },
  {
    slug: "oats",
    name: "Oats",
    description:
      "Oats are used in calming washes and scrubs. They feel familiar, soft, and kind to skin that is dry or easily unsettled.",
    benefits: [
      "A traditional comfort botanical",
      "Gives cleansers a creamy, low-foam feel",
      "Suits sensitive or winter skin rituals",
    ],
  },
  {
    slug: "ashwagandha",
    name: "Ashwagandha",
    description:
      "Ashwagandha is a traditional Ayurvedic root used in some Maroma wellness-leaning care for its earthy, settling character.",
    benefits: [
      "Adds a quiet, rooted herbal note",
      "Chosen for evening or restore-style rituals",
      "Pairs with sandalwood, sesame, and vetiver",
    ],
  },
  {
    slug: "saffron",
    name: "Saffron",
    description:
      "Saffron is a precious floral spice. A trace adds a honeyed, luxurious warmth to finer Maroma blends.",
    benefits: [
      "A rare, elegant accent",
      "Warms rose, sandalwood, and citrus",
      "Used sparingly so it stays refined",
    ],
  },
  {
    slug: "ginger",
    name: "Ginger",
    aliases: ["Ginger Grass"],
    description:
      "Ginger and ginger grass add a warm, lemony-spice snap. They keep a blend moving and a little fiery.",
    benefits: [
      "A waking spice top note",
      "Lifts heavier woods and resins",
      "Suits daytime body and home care",
    ],
  },
  {
    slug: "arnica",
    name: "Arnica",
    description:
      "Arnica is a mountain flower used in comforting body-care rituals after an active day.",
    benefits: [
      "A traditional botanical for tired-feeling skin",
      "Fits massage oils and balms",
      "Pairs with mint and rosemary",
    ],
  },
  {
    slug: "cucumber",
    name: "Cucumber",
    description:
      "Cucumber is a watery, green freshness used in face and body care when a formula should feel cool and light.",
    benefits: [
      "A clean, spa-like scent and feel",
      "Suits gels, mists, and after-sun care",
      "Pairs with aloe, mint, and citrus",
    ],
  },
  {
    slug: "indian-tulsi",
    name: "Indian Tulsi",
    description:
      "Tulsi (holy basil) is a sacred Indian herb with a clove-green scent. Maroma uses it for a clear, uplifting herbal note.",
    benefits: [
      "A distinctive Indian basil character",
      "Freshens body and home blends",
      "Pairs with lemon, neem, and sandalwood",
    ],
  },
  {
    slug: "manjistha",
    name: "Manjistha",
    description:
      "Manjistha is a traditional Ayurvedic root used in some Maroma skin formulas for its clarifying, evening character.",
    benefits: [
      "Chosen for even, cared-for looking skin rituals",
      "An authentic herbal colour story",
      "Pairs with turmeric, rose, and barberry",
    ],
  },
  {
    slug: "bringaraj",
    name: "Bringaraj",
    description:
      "Bringaraj is a classic Ayurvedic herb for hair. Maroma uses it in scalp and hair rituals for its dark, herbal character.",
    benefits: [
      "A traditional hair-care botanical",
      "Pairs with amla, brahmi, and coconut",
      "Supports a nourished, cared-for scalp feel",
    ],
  },
  {
    slug: "niacinamide",
    name: "Niacinamide",
    description:
      "Niacinamide is a form of vitamin B3 used in modern Maroma skin care to help skin feel even, comfortable, and cared for.",
    benefits: [
      "A light, daily skin-care active",
      "Supports a smoother-feeling finish",
      "Layers well under oils and creams",
    ],
  },
  {
    slug: "vitamin-e",
    name: "Vitamin E",
    aliases: ["Tocopherol"],
    description:
      "Vitamin E (tocopherol) is used to help protect oils in a formula and leave skin feeling conditioned.",
    benefits: [
      "Supports the stability of plant oils",
      "Adds a soft, cared-for skin feel",
      "A quiet helper in butters and serums",
    ],
  },
  {
    slug: "glycerine",
    name: "Glycerine",
    description:
      "Glycerine is a plant-derived humectant used to keep soaps and lotions feeling moist, not tight, after washing.",
    benefits: [
      "Helps skin hold onto water",
      "Softens the afterfeel of soaps",
      "A staple of comfortable daily care",
    ],
  },
  {
    slug: "panthenol",
    name: "Panthenol",
    description:
      "Panthenol (pro-vitamin B5) is used in hair and skin care for a soft, conditioned feel.",
    benefits: [
      "Helps hair feel smoother",
      "Comforts freshly washed skin",
      "A light, modern care ingredient",
    ],
  },
  {
    slug: "allantoin",
    name: "Allantoin",
    description:
      "Allantoin is a soothing skin-care ingredient used to help formulas feel gentle after cleansing.",
    benefits: [
      "Comforts easily unsettled skin",
      "A quiet addition to lotions and gels",
      "Supports a soft, recovered afterfeel",
    ],
  },
  {
    slug: "peptides",
    name: "Peptides",
    aliases: ["Lupine Peptides", "Peptides"],
    description:
      "Peptides are short protein fragments used in some Maroma face-care formulas to support a firmer, cared-for feel.",
    benefits: [
      "A modern skin-care support ingredient",
      "Used in evening or restore-style formulas",
      "Layers with hyaluronic acid and plant oils",
    ],
  },
  {
    slug: "pro-ceramides",
    name: "Pro-ceramides",
    description:
      "Pro-ceramides are used to support the skin's own comfort barrier, so creams feel more complete and less tight.",
    benefits: [
      "Helps dry skin feel settled",
      "A modern companion to plant butters",
      "Suits face creams and richer lotions",
    ],
  },
  {
    slug: "bakuchiol",
    name: "Bakuchiol",
    aliases: ["Bukachiol"],
    description:
      "Bakuchiol is a plant-derived alternative used in evening skin care for a smoother, more even-feeling finish.",
    benefits: [
      "A botanical option in nightly rituals",
      "Used in place of stronger retinoid stories",
      "Pairs with rosehip and vitamin E",
    ],
  },
  {
    slug: "retinol",
    name: "Retinol (Vitamin A)",
    description:
      "Retinol is used in selected Maroma evening formulas. It is a stronger skin-care ingredient and is always used with clear, gentle supporting oils.",
    benefits: [
      "Chosen for nightly refine-and-restore rituals",
      "Best used as directed on the product",
      "Balanced with comforting plant oils",
    ],
  },
  {
    slug: "zinc-oxide",
    name: "Zinc Oxide",
    aliases: ["Zincoxide", "Zinc Ricinoleate"],
    description:
      "Zinc ingredients are used in some Maroma care and deodorant formulas for a dry, protective, odour-aware finish.",
    benefits: [
      "Supports a fresh, comfortable wear",
      "A mineral option in natural care",
      "Used in light amounts for daily formulas",
    ],
  },
  {
    slug: "multani-mitti",
    name: "Multani Mitti",
    description:
      "Multani mitti is Fuller's earth, a traditional Indian clay used for a deep, cooling cleanse.",
    benefits: [
      "A classic face-mask clay",
      "Leaves skin feeling matt and refreshed",
      "Pairs with rose, sandalwood, and turmeric",
    ],
  },
  {
    slug: "bearberry",
    name: "Bearberry",
    description:
      "Bearberry leaf is used in some brightening-leaning skin formulas for its clean, alpine-herb character.",
    benefits: [
      "A traditional botanical in even-tone care",
      "A light herbal addition to serums and creams",
      "Pairs with licorice and niacinamide",
    ],
  },
  {
    slug: "flaxseed",
    name: "Flaxseed",
    description:
      "Flaxseed (linseed) is a nutty oil and gel used for a soft, conditioned feel in hair and body care.",
    benefits: [
      "A nourishing plant oil",
      "Used in hair-smoothing rituals",
      "Pairs with sesame and coconut",
    ],
  },
  {
    slug: "wheatgerm",
    name: "Wheatgerm",
    description:
      "Wheatgerm oil is a rich, vitamin-forward oil used in small amounts to nourish dry skin.",
    benefits: [
      "Adds density to a body oil",
      "A traditional nourishing carrier",
      "Best blended with lighter oils",
    ],
  },
  {
    slug: "spirulina",
    name: "Spirulina",
    description:
      "Spirulina is a green algae used in some masks and wellness-leaning care for a mineral, sea-fresh character.",
    benefits: [
      "A vivid botanical in face masks",
      "Adds a clean, green story",
      "Pairs with clay and cucumber",
    ],
  },
  {
    slug: "poppy",
    name: "Poppy",
    description:
      "Poppy seed is used as a fine, decorative scrub grain in some Maroma soaps and polishes.",
    benefits: [
      "A gentle physical polish",
      "Looks and feels handmade",
      "Rinses clean from skin",
    ],
  },
  {
    slug: "bengal-gram",
    name: "Bengal Gram",
    description:
      "Bengal gram (chana) flour is a traditional Indian cleanser: a soft, kitchen botanical used in face and body rituals.",
    benefits: [
      "A gentle, familiar cleanse",
      "Used in ubtan-style care",
      "Pairs with turmeric and yogurt-style rituals",
    ],
  },
  {
    slug: "cypriol",
    name: "Cypriol",
    description:
      "Cypriol (nagarmotha) is a smoky, vetiver-like root used in finer Indian-leaning perfume blends.",
    benefits: [
      "Adds dry, woody depth",
      "A distinctive Indian perfume note",
      "Pairs with sandalwood, vetiver, and rose",
    ],
  },
  {
    slug: "guaiac-wood",
    name: "Guaiac Wood",
    description:
      "Guaiac wood is a smoky, tea-like wood used to give a blend a dry, lingering finish.",
    benefits: [
      "A modern woody base",
      "Softens incense and spice",
      "Helps a fragrance last on skin",
    ],
  },
  {
    slug: "labdanum",
    name: "Labdanum",
    aliases: ["Rockrose"],
    description:
      "Labdanum (rockrose) is an amber-like resin: leathery, sweet, and sun-warmed. It is used in deeper home and body blends.",
    benefits: [
      "An amber, resinous heart",
      "Warms woods and vanilla",
      "A classic natural-perfume material",
    ],
  },
  {
    slug: "oakmoss",
    name: "Oakmoss",
    description:
      "Oakmoss is a forest-floor note used in classic cologne and chypre-style blends. It makes a fragrance feel complete.",
    benefits: [
      "Adds a mossy, elegant base",
      "Ties citrus to wood",
      "A traditional fine-fragrance material",
    ],
  },
  {
    slug: "elemi",
    name: "Elemi",
    description:
      "Elemi is a lemony resin from the Philippines, used to lift frankincense-style blends with a brighter spark.",
    benefits: [
      "A citrus-resin top",
      "Keeps incense blends from feeling heavy",
      "Pairs with olibanum, lemon, and woods",
    ],
  },
  {
    slug: "nutmeg",
    name: "Nutmeg",
    description:
      "Nutmeg is a dry, warm spice used in traces. It gives festive and men's blends a baked-wood hint.",
    benefits: [
      "A quiet spice accent",
      "Warms orange, clove, and cedarwood",
      "Used lightly so it stays wearable",
    ],
  },
  {
    slug: "amyris",
    name: "Amyris",
    description:
      "Amyris is a soft, sandalwood-like wood used as a gentle woody base in natural blends.",
    benefits: [
      "A creamy, affordable wood note",
      "Softens citrus and florals",
      "Helps a blend linger",
    ],
  },
  {
    slug: "spikenard",
    name: "Spikenard",
    description:
      "Spikenard is an ancient, earthy root oil: musky, green, and meditative. It is used in ritual and incense-leaning blends.",
    benefits: [
      "A deep, historic perfume note",
      "Grounds florals and resins",
      "Suits evening and meditation spaces",
    ],
  },
  {
    slug: "styrax",
    name: "Styrax",
    description:
      "Styrax is a sweet, leathery balsam used to give incense and amber blends their glow.",
    benefits: [
      "A balsamic, slightly smoky sweetness",
      "Fixes lighter notes",
      "Pairs with benzoin, vanilla, and woods",
    ],
  },
  {
    slug: "copaiba",
    name: "Balsam Copaiba",
    aliases: ["Copaiba"],
    description:
      "Copaiba balsam is a soft, honeyed resin from South America. It rounds a blend and adds a gentle woody sweetness.",
    benefits: [
      "A mild, skin-close balsam",
      "Softens spice and citrus",
      "Used in body oils and home blends",
    ],
  },
  {
    slug: "galbanum",
    name: "Galbanum Resin",
    aliases: ["Galbanum"],
    description:
      "Galbanum is a fiercely green resin: cut stems and bitter leaves. A drop gives a blend a modern, outdoor opening.",
    benefits: [
      "An intense green top note",
      "Cuts through sweetness",
      "Suits cologne and garden-fresh blends",
    ],
  },
  {
    slug: "cubeb",
    name: "Cubeb",
    description:
      "Cubeb is a tailed pepper with a dry, woody spice. It adds interest to men's and incense blends.",
    benefits: [
      "A refined pepper note",
      "Less hot than black pepper",
      "Pairs with vetiver, cedarwood, and citrus",
    ],
  },
  {
    slug: "black-pepper",
    name: "Black Pepper",
    aliases: ["Blackpepper"],
    description:
      "Black pepper is a dry, sparkling spice used in traces to wake up a woody or citrus blend.",
    benefits: [
      "Adds bite without sweetness",
      "A modern cologne accent",
      "Best beside cedarwood, grapefruit, and vetiver",
    ],
  },
  {
    slug: "oregano",
    name: "Oregano",
    description:
      "Oregano is a pungent kitchen herb used sparingly for a wild, Mediterranean green note.",
    benefits: [
      "A rustic herbal accent",
      "Suits outdoor and soap formulas",
      "Pairs with basil, lemon, and thyme-like ajowan",
    ],
  },
  {
    slug: "indian-borage",
    name: "Indian Borage",
    description:
      "Indian borage (karpooravalli) is a thick-leaved herb with a oregano-camphor scent, used in some South Indian care blends.",
    benefits: [
      "A local Tamil herbal note",
      "Fresh, slightly medicinal green character",
      "Fits outdoor and home-care formulas",
    ],
  },
  {
    slug: "bhumyamlaki",
    name: "Bhumyamlaki",
    description:
      "Bhumyamlaki is a traditional Ayurvedic herb used in some Maroma wellness-leaning formulas.",
    benefits: [
      "An authentic herbal addition",
      "Chosen for restore-style care",
      "Pairs with other Indian bitters and roots",
    ],
  },
  {
    slug: "masikai",
    name: "Masikai",
    description:
      "Masikai (oak gall) is a traditional astringent botanical used in some classic Indian care recipes.",
    benefits: [
      "A historic Ayurvedic material",
      "Used in clarifying, rinse-style care",
      "Part of Maroma's older herbal palette",
    ],
  },
  {
    slug: "rosewood",
    name: "Rosewood",
    aliases: ["Shiu"],
    description:
      "Rosewood and ho wood (shiu) are rosy, woody notes used to give a blend a soft, polished heart.",
    benefits: [
      "A gentle woody-floral middle",
      "Softens lavender and citrus",
      "A classic natural-perfume material",
    ],
  },
  {
    slug: "epsom-salt",
    name: "Epsom Salt",
    aliases: ["Glauber’s Salt", "Glauber's Salt"],
    description:
      "Mineral bath salts are used in soak formulas to make a bath feel restoring and quietly spa-like.",
    benefits: [
      "A simple, comforting soak",
      "Pairs with lavender, eucalyptus, and mint",
      "Rinses clean and leaves water feeling silky",
    ],
  },
  {
    slug: "natural-vinegar",
    name: "Natural Vinegar",
    description:
      "Natural vinegar is used in some hair rinses and household-leaning care for a clean, clarifying finish.",
    benefits: [
      "A traditional rinse ingredient",
      "Helps hair feel smooth after washing",
      "A simple, kitchen-close botanical acid",
    ],
  },
];

function slugify(value: string): string {
  return normalizeKeyIngredientName(value).replace(/\s+/g, "-");
}

function titleCase(value: string): string {
  return normalizeKeyIngredientName(value)
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function withImage(draft: IngredientDraft): IngredientPageContent {
  const extra = extraForIngredientSlug(draft.slug);
  return {
    slug: draft.slug,
    name: draft.name,
    aliases: draft.aliases ?? [],
    description: draft.description,
    benefits: draft.benefits,
    imageUrl: resolveKeyIngredientImage(draft.name) || resolveKeyIngredientImage(draft.aliases?.[0] || ""),
    inci: extra.inci || draft.name,
    scentProfile: extra.scentProfile || "Used for texture, care, and botanical character.",
    extraNotes: extra.extraNotes || "",
    rangeLabel: extra.rangeLabel || "Shop Maroma",
    rangeHref: extra.rangeHref || "/shop",
  };
}

const PAGES = DRAFTS.map(withImage);

const bySlug = new Map<string, IngredientPageContent>();
const byName = new Map<string, IngredientPageContent>();

for (const page of PAGES) {
  bySlug.set(page.slug, page);
  byName.set(normalizeKeyIngredientName(page.name), page);
  for (const alias of page.aliases) {
    bySlug.set(slugify(alias), page);
    byName.set(normalizeKeyIngredientName(alias), page);
  }
}

function fallbackPage(name: string): IngredientPageContent {
  const normalized = normalizeKeyIngredientName(name);
  return {
    slug: slugify(normalized || name),
    name: titleCase(name),
    aliases: [],
    description: `${titleCase(name)} is used in Maroma formulas as a botanical note, chosen to complement the other plants in the blend and to give the product its character.`,
    benefits: [
      "Adds a distinct botanical character to the formula",
      "Chosen to sit well with the other key ingredients",
      "Part of Maroma's plant-based palette from Auroville",
    ],
    imageUrl: resolveKeyIngredientImage(name),
    inci: name,
    scentProfile: "Used for texture, care, and botanical character.",
    extraNotes: "",
    rangeLabel: "Shop Maroma",
    rangeHref: "/shop",
  };
}

export function listIngredientPages(): IngredientPageContent[] {
  return [...PAGES].sort((a, b) => a.name.localeCompare(b.name));
}

export function ingredientSlugFromName(name: string): string {
  const match = byName.get(normalizeKeyIngredientName(name));
  return match?.slug || slugify(name);
}

export function getIngredientPage(slugOrName: string): IngredientPageContent {
  const trimmed = String(slugOrName || "").trim();
  if (!trimmed) return fallbackPage("Ingredient");
  return bySlug.get(slugify(trimmed)) || byName.get(normalizeKeyIngredientName(trimmed)) || fallbackPage(trimmed);
}

export function productsForIngredient(products: ProductRecord[], page: IngredientPageContent, limit = 8): ProductRecord[] {
  const needles = new Set(
    [page.name, page.slug.replace(/-/g, " "), ...page.aliases].map((value) => normalizeKeyIngredientName(value))
  );
  return products
    .filter((product) =>
      (product.attributes["Key Ingredients"] ?? []).some((item) => {
        const normalized = normalizeKeyIngredientName(item);
        if (needles.has(normalized)) return true;
        return [...needles].some((needle) => needle.length > 3 && (normalized.includes(needle) || needle.includes(normalized)));
      })
    )
    .slice(0, limit);
}
