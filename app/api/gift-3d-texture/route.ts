import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowedTextureSrc(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host.endsWith("googleapis.com") ||
      host.endsWith("firebasestorage.app") ||
      host.endsWith("googleusercontent.com") ||
      host.endsWith("public.blob.vercel-storage.com") ||
      host.endsWith("maromashopping.com") ||
      host.endsWith("maroma.com") ||
      host.endsWith("vercel.app") ||
      host.endsWith("shopify.com") ||
      host.endsWith("myshopify.com")
    );
  } catch {
    return false;
  }
}

/** Same-origin proxy so WebGL can sample Firebase/Blob reference photos. */
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src")?.trim() ?? "";
  if (!isAllowedTextureSrc(src)) {
    return NextResponse.json({ error: "Invalid texture source." }, { status: 400 });
  }

  const upstream = await fetch(src, { cache: "force-cache" });
  if (!upstream.ok) {
    return NextResponse.json({ error: "Texture fetch failed." }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "image/png";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image." }, { status: 415 });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
