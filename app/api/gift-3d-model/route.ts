import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowedModelSrc(src: string): boolean {
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
      host.endsWith("vercel.app") ||
      host.endsWith("fal.media") ||
      host.endsWith("fal.run")
    );
  } catch {
    return false;
  }
}

/** Same-origin proxy so Three.js can load reconstructed GLBs without CORS failures. */
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src")?.trim() ?? "";
  if (!isAllowedModelSrc(src)) {
    return NextResponse.json({ error: "Invalid model source." }, { status: 400 });
  }

  const upstream = await fetch(src, { cache: "force-cache" });
  if (!upstream.ok) {
    return NextResponse.json({ error: "Model fetch failed." }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "model/gltf-binary";
  if (!/gltf|octet-stream|binary/i.test(contentType) && !src.toLowerCase().includes(".glb")) {
    return NextResponse.json({ error: "Not a GLB model." }, { status: 415 });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
