/**
 * Clean scraped Amazon reviews, match them to catalog products, and
 * replace data/product-reviews.json with Amazon-only published reviews.
 */
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const RAW_PATH = path.join(root, "data", "amazon-reviews-raw.json");
const PRODUCTS_PATH = path.join(root, "data", "maroma-products.json");
const OUTPUT_PATH = path.join(root, "data", "product-reviews.json");
const MAP_PATH = path.join(root, "data", "amazon-review-match-report.json");

const STOP = new Set([
  "with",
  "and",
  "the",
  "for",
  "of",
  "a",
  "an",
  "in",
  "on",
  "to",
  "pack",
  "packs",
  "ml",
  "gms",
  "gm",
  "natural",
  "maroma",
  "count",
  "sticks",
  "stick",
  "from",
  "100",
  "each",
  "free",
  "oil",
]);

const ASIN_IDS = {
  B08L8Y2C8J: "812",
  B07JZ3NBWG: "2427",
  B09P6HRCX8: "8901",
  B09PRD2SPD: "8908",
  B09QSJ864Q: "9049",
  B000HLH5L4: "2950",
  B000HLAKLG: "2844",
  B000HLF2PK: "2919",
  B07HH69WBC: "1004695",
  B01N6OAXU8: "5349",
  B01198H64E: "2456",
  B07PHYCGQ1: "2461",
  B07KM546G4: "2465",
  B09V16SCXF: "4017",
  B097K2VZQG: "25009",
  B07S8X74BJ: "2536",
  B07HH6T93S: "2664",
  B094C9WXWF: "2444",
  B000HLH69U: "2870",
  B000LV5XPU: "3053",
  B000LV5XL4: "2995",
  B000LV5XLO: "2902",
  B000HLH69A: "2882",
  B07HH635MV: "1001937",
  B0D7QBB14M: "21830",
  B0D7Q6H7J8: "21832",
  B094Y4XXR8: "1004713",
  B09V11V9DW: "4040",
  B094D9WNJ8: "2438",
  B07HH59T74: "1004640",
  B08CBVFBTH: "795",
  B09QC55H1D: "849",
  B0C5M327PF: "1004695",
  B004RSU0EW: "15013",
  B0957TTF66: "5057",
  B0B6RNX5WM: "12115",
  B00CQ7K23A: "2913",
  B000LD8WMY: "3153",
  B0C5M1VZBZ: "1004691",
  B011942IOQ: "25012",
  B0842ND6K8: "4172",
  B0842N2H44: "4181",
  B07NR8R211: "3033",
  B07FTNBDDX: "2939",
};

const ASIN_HINTS = {
  B08L8Y2C8J: "Cedar Lavender Men's Deodorant Elevate",
  B07JZ3NBWG: "Citrus & Mint Deodorant",
  B09P6HRCX8: "Tonka Vetiver Men's Deodorant Captivate",
  B000HLH5L4: "Amber Incense Sticks",
  B000HLAKLG: "Cinnamon Incense Sticks",
  B000HLF2PK: "Patchouli Incense Sticks",
  B07HH69WBC: "Night Jasmine Roll On Perfume Oil",
  B01N6OAXU8: "Opium Flower Ambient Perfume 10ml",
  B094C9WXWF: "Lavender Vinegar Deodorant Spray",
  B000HLH69U: "Frankincense Myrrh Incense Sticks",
  B000LV5XPU: "Spiritual Perfume Incense Sticks",
  B000LV5XL4: "Jasmine Incense Sticks",
  B000LV5XLO: "Lemongrass Incense Sticks",
  B000HLH69A: "Lavender Incense Sticks",
  B07HH635MV: "Desert Blooms Roll On Perfume Oil",
  B094Y4XXR8: "Night Jasmine Solid Perfume",
  B09V11V9DW: "Moringa Serum",
  B07HH59T74: "Exotic Patchouli Ambient Perfume 10ml",
  B08CBVFBTH: "Cedar Lavender Men's Oil Perfume",
  B004RSU0EW: "Mystical Sandal Ambient Perfume 10ml",
};

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(norm(value).split(" ").filter((part) => part.length > 2 && !STOP.has(part)));
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function marketplaceFromText(text) {
  const match = String(text || "").match(/Reviewed in ([A-Za-z ]+?) on /i);
  if (!match) return "Amazon";
  const place = match[1].trim();
  if (/united states/i.test(place)) return "Amazon in the United States";
  if (/united kingdom/i.test(place)) return "Amazon in the United Kingdom";
  if (/india/i.test(place)) return "Amazon in India";
  if (/canada/i.test(place)) return "Amazon in Canada";
  if (/germany|deutschland/i.test(place)) return "Amazon in Germany";
  if (/italy|italia/i.test(place)) return "Amazon in Italy";
  if (/france/i.test(place)) return "Amazon in France";
  if (/spain|espa(?:n|ñ)a/i.test(place)) return "Amazon in Spain";
  if (/japan/i.test(place)) return "Amazon in Japan";
  return `Amazon in ${place}`;
}

function parseDate(text) {
  const blob = String(text || "");
  const intl = blob.match(/on (\d{1,2} [A-Za-z]+ \d{4})/);
  if (intl) {
    const date = new Date(intl[1]);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const us = blob.match(/on ([A-Za-z]+ \d{1,2}, \d{4})/);
  if (us) {
    const date = new Date(us[1]);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function firstValidRating(blob, fallback) {
  for (const match of String(blob).matchAll(/(\d+(?:\.\d+)?) out of 5 stars/gi)) {
    const value = Math.round(Number(match[1]));
    if (value >= 1 && value <= 5) return value;
  }
  const fromRaw = Math.round(Number(fallback));
  if (fromRaw >= 1 && fromRaw <= 5) return fromRaw;
  return 5;
}

function cleanReview(productTitle, raw) {
  const blob = decodeHtml(raw.body || "");
  if (!blob.trim()) return null;

  const rating = firstValidRating(blob, raw.rating);
  const authorMatch = blob.match(/^(.*?)(?:\d+(?:\.\d+)?) out of 5 stars/i);
  let author = (authorMatch?.[1] || decodeHtml(raw.author || "")).replace(/\s+/g, " ").trim();
  if (/placeholder/i.test(author) || author.length < 2) author = "Amazon customer";
  author = author.slice(0, 80);

  const titleMatch = blob.match(/out of 5 stars\s*(.*?)\s*Reviewed in/i);
  let title = (titleMatch?.[1] || "").replace(/\s+/g, " ").trim();
  if (title.length > 120) title = title.slice(0, 117).trim();

  const scentMatch = blob.match(/Scent Name:\s*([^\n]+?)(?:Size:|Verified Purchase|Brief content|$)/i);
  const variant = (raw.variant || scentMatch?.[1] || "").replace(/\s+/g, " ").trim();

  let body = blob.replace(
    /^.*?Reviewed in .+? on (?:\d{1,2} [A-Za-z]+ \d{4}|[A-Za-z]+ \d{1,2}, \d{4})/i,
    "",
  );
  body = body.replace(/Scent Name:\s*.*?(?=Size:|Verified Purchase|Brief content|$)/gi, " ");
  body = body.replace(/Size:\s*.*?(?=Verified Purchase|Brief content|$)/gi, " ");
  body = body.replace(/Verified Purchase/gi, " ");
  body = body.replace(/Brief content visible[\s\S]*?brief content\./gi, " ");
  body = body.split(/Read more/i)[0];
  body = body.replace(/Sorry, we couldn't translate[\s\S]*$/i, "");
  body = body.replace(/Translate review to English[\s\S]*$/i, "");
  body = body.replace(/Translated from[\s\S]*$/i, "");
  body = body.replace(/See original[\s\S]*$/i, "");
  body = body.replace(/Helpful[\s\S]*$/i, "");
  body = body.replace(/One person found this helpful[\s\S]*$/i, "");
  body = body.replace(/\d+ people found this helpful[\s\S]*$/i, "");
  body = body.replace(/Report[\s\S]*$/i, "");
  body = body.replace(/\s+/g, " ").trim();

  if (!body || body.length < 2) return null;
  if (/placeholder/i.test(decodeHtml(raw.author || "")) && /^good\.?$/i.test(body)) return null;

  return {
    amazonId: String(raw.id || "").replace(/^srp$/i, ""),
    productTitle,
    variant,
    author,
    rating,
    title,
    body: body.slice(0, 2000),
    createdAt: parseDate(blob),
    verifiedPurchase: raw.verified === true || /Verified Purchase/i.test(blob),
    marketplace: marketplaceFromText(blob),
  };
}

function scoreMatch(query, productName, productTokens) {
  const queryNorm = norm(query);
  const productNorm = norm(productName);
  if (!queryNorm || !productNorm) return 0;
  if (queryNorm === productNorm) return 1;
  const queryTokens = tokens(query);
  if (!queryTokens.size) return 0;
  const overlap = [...queryTokens].filter((token) => productTokens.has(token)).length / queryTokens.size;
  let extra = 0;
  if (queryNorm.includes("deodorant") && productNorm.includes("deodorant")) extra += 0.14;
  if (queryNorm.includes("incense") && productNorm.includes("incense")) extra += 0.14;
  if (queryNorm.includes("perfume") && productNorm.includes("perfume")) extra += 0.1;
  if (queryNorm.includes("serum") && productNorm.includes("serum")) extra += 0.14;
  if (queryNorm.includes("soap") && productNorm.includes("soap")) extra += 0.1;
  if (queryNorm.includes("sachet") && productNorm.includes("sachet")) extra += 0.12;
  if ((queryNorm.includes("rollon") || queryNorm.includes("roll on")) && productNorm.includes("solid")) extra -= 0.25;
  if (queryNorm.includes("incense") && /perfume|deodorant|soap|serum|cream/.test(productNorm) && !productNorm.includes("incense")) {
    extra -= 0.35;
  }
  if (queryNorm.includes("perfume") && !queryNorm.includes("incense") && productNorm.includes("incense")) extra -= 0.25;
  if (queryNorm.includes("moringa") && productNorm.includes("moringa")) extra += 0.2;
  if (queryNorm.includes("serum") && productNorm.includes("serum")) extra += 0.08;
  if (queryNorm.includes("spray") && productNorm.includes("spray")) extra += 0.1;
  return Math.min(1, overlap * 0.72 + extra);
}

function resolveProduct(item, catalog) {
  const mappedId = ASIN_IDS[item.asin];
  if (mappedId) {
    const mapped = catalog.find((row) => row.id === mappedId);
    if (mapped) return { product: mapped, score: 1 };
  }
  const hint = ASIN_HINTS[item.asin] || "";
  const query = `${hint} ${item.productTitle} ${item.variant}`.trim();
  let best = null;
  let bestScore = 0;
  for (const row of catalog) {
    const score = scoreMatch(query, row.name, row.tokens);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  if (best && bestScore >= 0.48) return { product: best, score: bestScore };
  return { product: null, score: bestScore };
}

function reviewId(productId, amazonId, body) {
  const seed = amazonId || createHash("sha1").update(`${productId}:${body}`).digest("hex").slice(0, 16);
  return `amz-${productId}-${seed}`.slice(0, 80);
}

function loadListings(rawFile) {
  if (Array.isArray(rawFile)) return rawFile;
  if (typeof rawFile.result?.value === "string") return JSON.parse(rawFile.result.value);
  if (Array.isArray(rawFile.listings)) return rawFile.listings;
  throw new Error("Unrecognized amazon-reviews-raw.json shape.");
}

function mergeListings(base, extra) {
  const byAsin = new Map();
  for (const listing of [...base, ...extra]) {
    const asin = listing.asin || "";
    if (!asin) continue;
    const current = byAsin.get(asin) || { asin, title: listing.title || "", reviews: [] };
    if (listing.title) current.title = listing.title;
    const seen = new Set(current.reviews.map((review) => review.id));
    for (const review of listing.reviews || []) {
      if (!review?.id || seen.has(review.id)) continue;
      seen.add(review.id);
      current.reviews.push(review);
    }
    byAsin.set(asin, current);
  }
  return [...byAsin.values()];
}

async function main() {
  const rawFile = JSON.parse(await fs.readFile(RAW_PATH, "utf8"));
  let listings = loadListings(rawFile);
  try {
    const extraRaw = JSON.parse(await fs.readFile(path.join(root, "data", "amazon-reviews-extra.json"), "utf8"));
    listings = mergeListings(listings, loadListings(extraRaw));
  } catch {
    // extra file is optional
  }
  const products = JSON.parse(await fs.readFile(PRODUCTS_PATH, "utf8"));
  const catalog = products.map((product) => ({
    id: String(product.id),
    name: String(product.name || ""),
    tokens: tokens(product.name),
  }));

  const cleaned = [];
  for (const listing of listings) {
    for (const review of listing.reviews || []) {
      const item = cleanReview(listing.title || "", review);
      if (!item) continue;
      item.asin = listing.asin || "";
      cleaned.push(item);
    }
  }

  const reviews = [];
  const unmatched = [];
  const matches = [];
  const seen = new Set();
  for (const item of cleaned) {
    const { product, score } = resolveProduct(item, catalog);
    if (!product) {
      unmatched.push({ asin: item.asin, title: item.productTitle, variant: item.variant, score });
      continue;
    }
    const id = reviewId(product.id, item.amazonId, item.body);
    const bodyKey = `${product.id}:${norm(item.body)}`;
    if (seen.has(id) || seen.has(bodyKey)) continue;
    seen.add(id);
    seen.add(bodyKey);
    reviews.push({
      id,
      productId: product.id,
      author: item.author,
      rating: item.rating,
      title: item.title,
      body: item.body,
      source: "amazon",
      marketplace: item.marketplace,
      status: "published",
      createdAt: item.createdAt,
      verifiedPurchase: item.verifiedPurchase,
      helpfulCount: 0,
    });
    matches.push({
      asin: item.asin,
      amazonTitle: item.productTitle,
      catalogId: product.id,
      catalogName: product.name,
      score,
    });
  }

  reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ reviews }, null, 2)}\n`, "utf8");

  const byProduct = {};
  for (const review of reviews) byProduct[review.productId] = (byProduct[review.productId] || 0) + 1;
  const uniqueMatches = [];
  const seenMatch = new Set();
  for (const row of matches) {
    const key = `${row.asin}:${row.catalogId}`;
    if (seenMatch.has(key)) continue;
    seenMatch.add(key);
    uniqueMatches.push(row);
  }
  await fs.writeFile(
    MAP_PATH,
    `${JSON.stringify({ count: reviews.length, products: Object.keys(byProduct).length, uniqueMatches, unmatched }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote ${reviews.length} Amazon reviews for ${Object.keys(byProduct).length} products`);
  console.log("Matches:");
  for (const row of uniqueMatches) {
    console.log(`  ${row.asin} -> ${row.catalogId} ${row.catalogName} (${row.score.toFixed(2)})`);
  }
  if (unmatched.length) {
    console.log(`Unmatched: ${unmatched.length}`);
    for (const row of unmatched) console.log(`  - ${row.asin} ${row.title}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
