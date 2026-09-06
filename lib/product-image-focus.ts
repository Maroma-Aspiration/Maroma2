/**
 * Focal corrections from the catalogue image audit. These source photos have
 * unusually large blank margins, so a modest transform centres the product
 * itself while preserving it in full.
 */
const LOW_SUBJECTS = new Set([
  "4957","4958","1001502","1001507","1001509","14248","4964","2260","25010","25011","19142","4969","4974","5350","2394","9573","2420","4998","25013","5333","4979","4984","4993","1002322","1002323","1002324","2402","15013","5349","5003","5334","5008","5355","5013","25012","5360","15324","5018","5318","5019","5328","5024","25009","25008","5365","5344","5029"
]);
const HIGH_SUBJECTS = new Set(["3162", "3147", "3138"]);
const RIGHT_SUBJECTS = new Set(["1004691", "1004650", "1001092"]);

export function productImageTransform(productId: string): string | undefined {
  const x = RIGHT_SUBJECTS.has(productId) ? "-8%" : "0";
  const y = LOW_SUBJECTS.has(productId) ? "-11%" : HIGH_SUBJECTS.has(productId) ? "9%" : "0";
  return x === "0" && y === "0" ? undefined : `translate(${x}, ${y}) scale(1.11)`;
}
