import { decodeBasicHtmlEntities } from "./decode-html-entities";
import type { ProductRecord } from "./product-types";
import type { QrInstructionBlock } from "./qr-product-page-types";

export type GeneratedQrInstructions = {
  title: string;
  intro: string;
  instructions: QrInstructionBlock[];
  safetyNotes: string[];
};

const block = (id: string, heading: string, body: string): QrInstructionBlock => ({ id, heading, body });

export function generateQrInstructions(product: ProductRecord): GeneratedQrInstructions {
  const name = decodeBasicHtmlEntities(product.name);
  const context = [name, ...product.categories, ...product.tags].join(" ").toLowerCase();
  const commonSafety = ["For external use only unless the product label explicitly says otherwise.", "Keep out of reach of children and pets.", "Avoid contact with eyes. If irritation occurs, discontinue use and consult a healthcare professional."];
  if (/incense|cone|dhoop|smudge/.test(context)) return {
    title: `${name} · How to enjoy it`, intro: "Create a calm, fragrant moment with these simple use and care steps.",
    instructions: [block("light", "Light safely", "Place the incense stick or cone in a stable, heat-resistant holder. Light the tip, allow the flame to burn for a few seconds, then gently blow it out so it smoulders."), block("place", "Enjoy the fragrance", "Keep the holder on a clear surface away from drafts, open windows and anything flammable. Allow the incense to finish naturally and let ash cool before disposal.")],
    safetyNotes: ["Never leave burning incense unattended.", "Use only in a well-ventilated space.", "Keep away from curtains, paper and other flammable items."]
  };
  if (/sachet|colibri|hanging|jute/.test(context)) return {
    title: `${name} · Fragrance care`, intro: "A gentle way to scent the small spaces you use every day.",
    instructions: [block("place", "Place or hang", "Hang the item in a wardrobe, closet, car or other small enclosed space. Keep it away from direct sunlight and damp surfaces."), block("refresh", "Refresh the scent", "When the fragrance softens, refresh it with the accompanying perfume oil if supplied. Apply oil carefully and allow it to absorb before placing it back.")],
    safetyNotes: ["Do not open or ingest the fragrance contents.", "Keep fragrance oils away from polished, painted or delicate surfaces."]
  };
  if (/essential oil|aromatherapy oil/.test(context)) return {
    title: `${name} · How to use`, intro: "A concentrated natural fragrance for your home and wellbeing rituals.",
    instructions: [block("diffuse", "Diffuse", "Add a few drops to a compatible diffuser, following your diffuser's instructions."), block("dilute", "Dilute before skin use", "If using on skin, always dilute first with a suitable carrier oil. Start with a small amount and patch test before wider use.")],
    safetyNotes: ["Do not use undiluted on skin.", "Avoid use around eyes and sensitive areas.", "Keep the bottle upright, tightly closed and away from heat."]
  };
  if (/solid perfume|balm perfume/.test(context)) return {
    title: `${name} · How to wear`, intro: "A soft, personal fragrance made for an easy daily ritual.",
    instructions: [block("apply", "Apply", "With clean hands, glide a fingertip across the wax paste and apply directly to pulse points such as wrists, neck or behind the ears."), block("reapply", "Reapply as desired", "Use a small amount and reapply through the day whenever you would like a fresh layer of fragrance.")],
    safetyNotes: commonSafety
  };
  if (/face|cream|oil|serum|moisturi[sz]er|mask|scrub|body|lotion/.test(context)) return {
    title: `${name} · How to use`, intro: "A simple care ritual for clean, comfortable and naturally glowing skin.",
    instructions: [block("prepare", "Prepare skin", "Start with clean, dry skin. Use the amount suggested on your product label."), block("apply", "Apply gently", "Massage into the face, neck or body with gentle upward strokes. Avoid the immediate eye area unless the product is specifically made for it."), block("routine", "Make it part of your routine", "Use regularly as directed on the label. Layer with compatible products as desired.")],
    safetyNotes: commonSafety
  };
  return {
    title: `${name} · Product guide`, intro: "Helpful information for getting the best from your Maroma product.",
    instructions: [block("use", "Use as directed", "Follow the directions on the product label and use only for its intended purpose."), block("store", "Store with care", "Keep the product tightly closed when not in use and store in a cool, dry place away from direct sunlight.")],
    safetyNotes: commonSafety
  };
}
