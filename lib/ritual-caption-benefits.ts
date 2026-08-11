import { decodeBasicHtmlEntities } from "./decode-html-entities";
import type { ProductRecord } from "./product-types";

const DEFAULT_WORD = "nourish";

const WORD_RULES: { test: RegExp; word: string }[] = [
  { test: /\blip balm\b/, word: "moisturise" },
  { test: /\bunder[\s-]?eye\b/, word: "revive" },
  { test: /\bface mask\b/, word: "purify" },
  { test: /\bface wash\b|\bfoaming\b/, word: "cleanse" },
  { test: /\bface cream scrub\b|\bcream scrub\b/, word: "polish" },
  { test: /\bface wash powder\b|\bwash powder\b/, word: "renew" },
  { test: /\bhemp serum\b/, word: "balance" },
  { test: /\bhemp face cream\b|\bhemp cream\b/, word: "nourish" },
  { test: /\borange blossom\b/, word: "refresh" },
  { test: /\bgrapefruit\b/, word: "awaken" },
  { test: /\blemon\b/, word: "brighten" },
  { test: /\borange lip\b/, word: "soften" },
  { test: /\bturmeric\b/, word: "glow" },
  { test: /\bsaffron\b/, word: "illuminate" },
  { test: /\bfrankincense\b/, word: "restore" },
  { test: /\bmoringa\b/, word: "rejuvenate" },
  { test: /\bjojoba\b/, word: "harmonise" },
  { test: /\balmond\b.*\bserum\b|\balmond serum\b/, word: "smooth" },
  { test: /\bapple stem\b/, word: "firm" },
  { test: /\bavocado\b/, word: "hydrate" },
  { test: /\bface serum\b|\bserum\b/, word: "replenish" },
  { test: /\bface cream\b|\bface lotion\b/, word: "moisturise" },
  { test: /\bface oil\b/, word: "nourish" },
  { test: /\btoner\b|\bmist\b/, word: "refresh" },
  { test: /\bscrub\b|\bexfoliat/, word: "polish" },
  { test: /\bsun\b|\bspf\b/, word: "protect" },
  { test: /\bshampoo\b/, word: "cleanse" },
  { test: /\bconditioner\b/, word: "soften" },
  { test: /\bbody wash\b|\bshower gel\b/, word: "refresh" },
  { test: /\bbody lotion\b|\bbody cream\b/, word: "hydrate" },
  { test: /\bhand cream\b/, word: "comfort" },
  { test: /\bdeodorant\b/, word: "freshen" },
];

const CLUE_WORDS: { test: RegExp; word: string }[] = [
  { test: /\bmoistur/i, word: "moisturise" },
  { test: /\bhydrat/i, word: "hydrate" },
  { test: /\bbright/i, word: "brighten" },
  { test: /\bnourish/i, word: "nourish" },
  { test: /\bsooth/i, word: "soothe" },
  { test: /\bcalm/i, word: "calm" },
  { test: /\bprotect/i, word: "protect" },
  { test: /\brepair/i, word: "restore" },
  { test: /\bfirm/i, word: "firm" },
  { test: /\bglow/i, word: "glow" },
  { test: /\bexfoliat/i, word: "polish" },
  { test: /\banti[\s-]?age|wrinkle|fine line/i, word: "rejuvenate" },
  { test: /\bblemi|acne|pimple/i, word: "clarify" },
  { test: /\bpuff/i, word: "revive" },
  { test: /\bdark circle/i, word: "awaken" },
  { test: /\brefresh/i, word: "refresh" },
  { test: /\bbalance/i, word: "balance" },
  { test: /\bclean/i, word: "cleanse" },
  { test: /\bdry\b/, word: "moisturise" },
  { test: /\boily\b/, word: "balance" },
  { test: /\bsensitive\b/, word: "comfort" },
];

const FALLBACK_WORDS = [
  "refresh",
  "rejuvenate",
  "moisturise",
  "cleanse",
  "nourish",
  "soothe",
  "brighten",
  "balance",
  "restore",
  "renew",
  "purify",
  "hydrate",
  "revive",
  "calm",
  "soften",
  "glow",
] as const;

function normalizeText(product: ProductRecord): string {
  return decodeBasicHtmlEntities(
    `${product.name} ${product.shortDescription || ""} ${product.description || ""} ${product.tags.join(" ")} ${product.categories.join(" ")}`
  )
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hashWordIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

/** Single italic caption word for ritual carousel tiles. */
export function getRitualCaptionWord(product: ProductRecord): string {
  const text = normalizeText(product);

  for (const rule of WORD_RULES) {
    if (rule.test.test(text)) {
      return rule.word;
    }
  }

  for (const clue of CLUE_WORDS) {
    if (clue.test.test(text)) {
      return clue.word;
    }
  }

  return FALLBACK_WORDS[hashWordIndex(product.id || product.name, FALLBACK_WORDS.length)] ?? DEFAULT_WORD;
}
