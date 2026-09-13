import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { finalizeFirebaseDirectUpload, isCanvasFirebaseConfigured } from "../../../../lib/canvas-firebase-storage";
import { registerSiteMediaItem } from "../../../../lib/site-media-gallery-store";

export const runtime = "nodejs";

async function requireAdmin(): Promise<boolean> {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  return session?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  if (!isCanvasFirebaseConfigured()) {
    return NextResponse.json({ error: "Firebase Storage is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as {
    path?: string;
    contentType?: string;
    downloadToken?: string;
    label?: string;
    tags?: string[];
    /** When true, the file is not indexed in the shared media gallery. */
    skipGallery?: boolean;
  };
  const path = String(body.path ?? "").replace(/^\/+/, "");
  const contentType = String(body.contentType ?? "application/octet-stream");
  const downloadToken = String(body.downloadToken ?? "").trim();
  if (!path || !downloadToken) {
    return NextResponse.json({ error: "Missing upload details." }, { status: 400 });
  }

  const url = await finalizeFirebaseDirectUpload(path, contentType, downloadToken);
  const filename = path.split("/").pop() ?? path;
  if (body.skipGallery !== true) {
    try {
      await registerSiteMediaItem({
        url,
        filename,
        label: body.label || filename,
        tags: body.tags ?? ["firebase"],
      });
    } catch {
      /* gallery index is optional */
    }
  }
  return NextResponse.json({ ok: true, url, filename });
}
