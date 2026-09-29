/**
 * Crop ingredient stills from Taijasa product boards and replace
 * public/key-ingredients files used across the shop.
 */
import { spawnSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const destDir = path.join(root, "public", "key-ingredients");
const ocrPath = "/tmp/ingredient-ocr.txt";
const cropDir = "/tmp/ing-unique";
const boardsRoot = "/tmp/maroma-ingredients/All files";

const NAME_TO_FILE = [
  [/calendula/, "calendula.webp"],
  [/olive/, "olive.webp"],
  [/kokum/, "kokum.webp"],
  [/shea/, "shea butter.webp"],
  [/avocado/, "avocado.webp"],
  [/hyaluronic/, "hyaluronic.png"],
  [/bakuchiol/, "bakuchiol.png"],
  [/apricot/, "apricot.webp"],
  [/coconut/, "coconut.webp"],
  [/niacinamide/, "niacinamide.png"],
  [/lupine/, "lupine.png"],
  [/peptide/, "peptides.png"],
  [/ceramide/, "pro-ceramides.png"],
  [/water lily|waterlily/, "water lily.webp"],
  [/turmeric/, "turmeric.webp"],
  [/plant collagen|collagen/, "plant-collagen.webp"],
  [/pomegranate/, "pomegranate.webp"],
  [/aha|fruit acid/, "aha-fruit-acid.webp"],
  [/saffron/, "saffron.png"],
  [/brahmi/, "brahmi.png"],
  [/licorice|liquorice/, "licorice.webp"],
  [/bearberry/, "bearberry.png"],
  [/kaolin/, "kaolin clay.webp"],
  [/glycerin|glycerine/, "glycerine.png"],
  [/sunflower/, "sunflower.png"],
  [/amla/, "amla.png"],
  [/lavender/, "lavender.webp"],
  [/aloe/, "aloe.webp"],
  [/olibanum|frankincense/, "olibanum_resin.webp"],
  [/tea tree|teatree/, "teatree.webp"],
  [/rose water|rose absolute|^rose\b/, "rose.webp"],
  [/bamboo charcoal|charcoal/, "charcoal.webp"],
  [/walnut/, "walnut.png"],
  [/multani/, "multani-mitti.png"],
  [/rosemary/, "rosemary.webp"],
  [/vetiver/, "vetiver.webp"],
  [/petitgrain/, "petitgrain.webp"],
  [/jasmine/, "jasmine.webp"],
  [/arrow ?root/, "arrow root.webp"],
  [/corn flour|cornflour/, "corn-flour.webp"],
  [/orange/, "orange.webp"],
  [/jojoba/, "jojoba.webp"],
  [/almond/, "almond.webp"],
  [/grapeseed|grape seed/, "grapeseed.webp"],
  [/cocoa/, "cocoa.webp"],
  [/lemon/, "lemon.webp"],
  [/ylang|yang yang/, "ylang ylang.webp"],
  [/cucumber/, "cucumber.png"],
  [/quinoa/, "quinoa.webp"],
  [/coffee/, "coffee.webp"],
  [/cedarwood|cedar wood/, "cedarwood.webp"],
  [/henna/, "henna.webp"],
  [/fenugreek/, "fenugreek.webp"],
  [/peppermint|mint/, "peppermint.webp"],
  [/patchouli/, "patchouli.webp"],
  [/bergamot/, "bergamot.webp"],
  [/geranium/, "geranium.webp"],
  [/tonka/, "tonka bean.webp"],
  [/vanilla/, "vanilla.png"],
  [/palmarosa/, "palmarosa.webp"],
  [/natural vinegar|^vinegar$/, "natural-vinegar.png"],
  [/bicarbonate/, "bicarbonate.webp"],
  [/retinol|vitamin a/, "retinol.png"],
  [/vitamin e/, "vitamin-e.png"],
  [/black clay/, "black clay.webp"],
  [/sesame oil/, "sesame oil.webp"],
  [/sesame/, "sesame.png"],
  [/rice bran/, "rice-bran.webp"],
  [/candelilla|wax/, "wax.webp"],
];

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

function parseOcr(raw) {
  const blocks = [];
  let current = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith("FILE\t")) {
      if (current) blocks.push(current);
      current = { file: line.slice(5).trim(), lines: [] };
      continue;
    }
    if (line === "END") continue;
    if (line.startsWith("TEXT\t") && current) current.lines.push(line.slice(5).trim());
  }
  if (current) blocks.push(current);
  return blocks;
}

function looksLikeIngredient(line) {
  return /(oil|extract|butter|acid|powder|wax|glycerin|glycerine|water|absolute|flour|resinoid|granules|peptide|collagen|ceramide|vinegar|bicarbonate|kaolin|aloe|bakuchiol|niacinamide|saffron|amla|brahmi|multani|vetiver|tonka|palmarosa|ylang|jojoba|quinoa|hyaluronic|calendula|kokum|shea|olive|coconut|lavender|rose|lemon|orange|bergamot|patchouli|cedarwood|olibanum|charcoal|sunflower|walnut|cucumber|coffee|vanilla|geranium|henna|fenugreek|pomegranate|arrowroot|candelilla|licorice|bearberry|lupine|turmeric|collagen|aha|petitgrain|jasmine|rosemary|avocado|apricot|almond|cocoa|mint|retinol|vitamin|sesame|black clay)/i.test(
    line,
  );
}

function extractNames(lines) {
  const names = [];
  for (const line of lines) {
    const text = line.replace(/\s+/g, " ").trim();
    if (text.length < 3 || text.length > 48) continue;
    if (/^maroma/i.test(text)) continue;
    if (/fl\.?\s*oz|fair trade|100%|natural essential|no alcohol|no paraben/i.test(text)) continue;
    if (/^(gentle|restores|replenishes|nourishes|deep|smooths|softens|brightens|firms|strengthens|calms|enhances|promotes|protects|revives|soothes|absorbs|retain|antioxidant|clarifying|puritying|purifying|refreshes|calming|rich|locks|helps|awaken|improve|healthy|enhance|grounding|promote|natural|earthy|claritying|sottens|retreshes|comtort)/i.test(text)) {
      continue;
    }
    if (looksLikeIngredient(text)) names.push(text);
  }
  return names.slice(-4);
}

function destFile(name) {
  const normalized = name.toLowerCase().replace(/yang yang/g, "ylang ylang");
  for (const [pattern, file] of NAME_TO_FILE) {
    if (pattern.test(normalized)) return file;
  }
  return "";
}

const CROPS = [
  { key: "tl", vf: "crop=iw*0.435:ih*0.09:iw*0.056:ih*0.54" },
  { key: "tr", vf: "crop=iw*0.435:ih*0.09:iw*0.516:ih*0.54" },
  { key: "bl", vf: "crop=iw*0.435:ih*0.095:iw*0.056:ih*0.775" },
  { key: "br", vf: "crop=iw*0.435:ih*0.095:iw*0.516:ih*0.775" },
];

async function main() {
  const ocr = parseOcr(await fs.readFile(ocrPath, "utf8"));
  await fs.rm(cropDir, { recursive: true, force: true });
  await fs.mkdir(cropDir, { recursive: true });

  const chosen = new Map();
  const report = [];
  for (const block of ocr) {
    const names = extractNames(block.lines);
    const source = path.join(boardsRoot, block.file);
    report.push({ file: block.file, names });
    if (names.length !== 4) continue;
    for (let index = 0; index < 4; index += 1) {
      const dest = destFile(names[index]);
      if (!dest || chosen.has(dest)) continue;
      const ext = path.extname(dest);
      const temp = path.join(cropDir, `${path.basename(dest, ext)}-src.jpg`);
      ffmpeg(["-i", source, "-vf", CROPS[index].vf, temp]);
      chosen.set(dest, { temp, name: names[index], from: block.file });
    }
  }

  await fs.mkdir(destDir, { recursive: true });
  for (const [dest, info] of chosen) {
    const out = path.join(destDir, dest);
    ffmpeg(["-i", info.temp, "-vf", "scale=1200:-1", path.join(cropDir, `${path.basename(dest)}.png`)]);
    const png = path.join(cropDir, `${path.basename(dest)}.png`);
    const convert = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import sharp from 'sharp'; await sharp(process.argv[1]).${dest.endsWith(".png") ? "png()" : "webp({quality:82})"}.toFile(process.argv[2])`,
        png,
        out,
      ],
      { cwd: "/tmp/sharp-convert", stdio: "inherit" },
    );
    if (convert.status !== 0) throw new Error(`sharp failed for ${dest}`);
  }

  console.log(`Wrote ${chosen.size} ingredient images`);
  for (const [dest, info] of [...chosen.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${dest.padEnd(28)} <- ${info.name} (${info.from})`);
  }
  const unmatched = report.filter((row) => row.names.length !== 4);
  if (unmatched.length) {
    console.log("Boards with unexpected name counts:");
    for (const row of unmatched) console.log(`  ${row.file}: ${row.names.join(" | ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
