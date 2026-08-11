/** True when the public site hides admin chrome (production / client-demo deployment). */
export function isProductionView(): boolean {
  return process.env.NEXT_PUBLIC_HIDE_ADMIN_UI === "true";
}
