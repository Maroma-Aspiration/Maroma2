/** The gncn27oahij4ancd Vercel Blob store is suspended and returns 403 HTML. */

export function isLegacyBlobMediaUrl(url: unknown): boolean {
  return typeof url === "string" && /\.public\.blob\.vercel-storage\.com/i.test(url);
}

export function isFirebasePublicMediaUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return (
    /firebasestorage\.googleapis\.com\/v0\/b\//i.test(trimmed) ||
    /\.firebasestorage\.app\//i.test(trimmed)
  );
}

export function isUsablePublicMediaUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isLegacyBlobMediaUrl(trimmed)) return false;
  return true;
}

export function firstUsablePublicMediaUrl(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (isUsablePublicMediaUrl(candidate)) return candidate.trim();
  }
  return "";
}
