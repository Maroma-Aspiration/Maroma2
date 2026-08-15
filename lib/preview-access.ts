export const PREVIEW_COOKIE = "maroma_preview_access";

export async function previewAccessToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`maroma-preview:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

