/** When true, hides admin chrome (top bar, floating panel, edit triggers). Set NEXT_PUBLIC_HIDE_ADMIN_UI=false to restore. */
export function isAdminUiHidden(): boolean {
  return process.env.NEXT_PUBLIC_HIDE_ADMIN_UI === "true";
}
