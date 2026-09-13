function extensionForFile(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  if (file.type.includes("gif")) return "gif";
  if (file.type.includes("webm")) return "webm";
  if (file.type.includes("quicktime")) return "mov";
  if (file.type.includes("mp4")) return "mp4";
  return "bin";
}

export async function uploadFileToFirebase(
  file: File,
  prefix: string,
  options?: { skipGallery?: boolean }
): Promise<string> {
  const path = `${prefix.replace(/\/+$/, "")}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionForFile(file)}`;
  const contentType = file.type || "application/octet-stream";
  const signRes = await fetch("/api/public-media/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ path, contentType }),
  });
  const sign = (await signRes.json()) as {
    uploadUrl?: string;
    path?: string;
    downloadToken?: string;
    contentType?: string;
    error?: string;
  };
  if (!signRes.ok || !sign.uploadUrl || !sign.path || !sign.downloadToken) {
    throw new Error(sign.error || "Could not start Firebase upload.");
  }

  const putRes = await fetch(sign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": sign.contentType || contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Could not upload the file to Firebase Storage.");
  }

  const doneRes = await fetch("/api/public-media/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      path: sign.path,
      contentType: sign.contentType || contentType,
      downloadToken: sign.downloadToken,
      label: file.name,
      ...(options?.skipGallery ? { skipGallery: true } : {}),
    }),
  });
  const done = (await doneRes.json()) as { url?: string; error?: string };
  if (!doneRes.ok || !done.url) {
    throw new Error(done.error || "Could not finish Firebase upload.");
  }
  return done.url;
}
