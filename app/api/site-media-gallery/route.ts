import { NextResponse } from "next/server";
import {
  deleteSiteMediaItem,
  readSiteMediaGallery,
  updateSiteMediaItem,
} from "../../../lib/site-media-gallery-store";

export const runtime = "nodejs";

export async function GET() {
  const store = await readSiteMediaGallery();
  return NextResponse.json(store);
}

type PostBody = {
  deleteId?: string;
  update?: {
    id: string;
    label?: string;
    alt?: string;
    tags?: string[];
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;

    if (body.deleteId) {
      const deleted = await deleteSiteMediaItem(body.deleteId);
      if (!deleted) {
        return NextResponse.json({ error: "Image not found." }, { status: 404 });
      }
      const store = await readSiteMediaGallery();
      return NextResponse.json({ ok: true, ...store });
    }

    if (body.update?.id) {
      const updated = await updateSiteMediaItem(body.update.id, {
        label: body.update.label,
        alt: body.update.alt,
        tags: body.update.tags,
      });
      if (!updated) {
        return NextResponse.json({ error: "Image not found." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, item: updated });
    }

    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unable to update media gallery." }, { status: 500 });
  }
}
