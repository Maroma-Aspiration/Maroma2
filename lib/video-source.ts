/** Browser-safe video source typing. Safari needs an explicit MP4 MIME type. */
function videoPath(src: string): string {
  let path = String(src || "").split("?")[0].split("#")[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep raw path */
  }
  return path.toLowerCase();
}

export function videoMimeType(src: string): string | undefined {
  const path = videoPath(src);
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".ogg") || path.endsWith(".ogv")) return "video/ogg";
  if (path.endsWith(".mp4") || path.endsWith(".m4v")) return "video/mp4";
  // Unknown extensions are left untyped; product videos are now restricted
  // to MP4 so Safari receives an explicit browser-safe source type.
  return undefined;
}

export function isLikelyPlayableWebVideo(src: string): boolean {
  const path = videoPath(src);
  return /\.(mp4|m4v|webm|ogg|ogv|mov)$/i.test(path) || /video\/mp4/i.test(src);
}
