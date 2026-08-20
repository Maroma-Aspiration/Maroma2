import type { GiftElement } from "./gift-builder-types";

/** Packaging silhouette used for photo-wrapped 3D previews. */
export type GiftShapeFamily = "bottle" | "jar" | "bar" | "box" | "candle" | "tube" | "pouch";

/**
 * Best-effort shape from category, name, and packing dimensions.
 * Packing centimetres stay authoritative — this only picks a visual silhouette.
 */
export function resolveGiftShapeFamily(
  element: GiftElement,
  override?: GiftShapeFamily | "auto" | null
): GiftShapeFamily {
  if (override && override !== "auto") return override;

  const name = element.name.toLowerCase();
  const footprint = Math.max(element.lengthCm, element.widthCm);
  const tall = element.heightCm >= footprint * 1.35;
  const flat = element.heightCm < Math.min(element.lengthCm, element.widthCm) * 0.5;
  const roundish = Math.abs(element.lengthCm - element.widthCm) < 1.5;

  if (element.category === "candle") return "candle";
  if (element.category === "soap") return "bar";
  if (name.includes("pouch") || name.includes("sachet")) return "pouch";
  if (name.includes("tube") || name.includes("balm stick")) return "tube";
  if (name.includes("incense")) return "box";

  if (element.category === "scent") {
    return tall ? "bottle" : "box";
  }

  if (element.category === "wellness") {
    if (tall) return "bottle";
    if (roundish) return "jar";
    return flat ? "pouch" : "box";
  }

  // accent
  if (flat) return "pouch";
  if (tall && roundish) return "bottle";
  if (roundish) return "jar";
  return "box";
}
