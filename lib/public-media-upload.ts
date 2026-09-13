import { promises as fs } from "fs";
import path from "path";
import { isCanvasFirebaseConfigured, uploadCanvasFile } from "./canvas-firebase-storage";

export async function persistPublicMediaFile(
  file: File,
  prefix: string,
  local?: { dir: string; urlPrefix: string }
): Promise<{ url: string; filename: string; storage: "firebase" | "local" }> {
  if (isCanvasFirebaseConfigured()) {
    const url = await uploadCanvasFile(file, prefix);
    const encoded = url.split("/o/")[1]?.split("?")[0] ?? file.name;
    const filename = decodeURIComponent(encoded).split("/").pop() ?? file.name;
    return { url, filename, storage: "firebase" };
  }

  if (!process.env.VERCEL && local) {
    await fs.mkdir(local.dir, { recursive: true });
    const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await fs.writeFile(path.join(local.dir, fileName), Buffer.from(await file.arrayBuffer()));
    return {
      url: `${local.urlPrefix.replace(/\/$/, "")}/${fileName}`,
      filename: fileName,
      storage: "local",
    };
  }

  throw new Error("Firebase Storage is not configured.");
}
