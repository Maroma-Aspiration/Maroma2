import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { downloadLegacyBlobUrl, isCanvasBlobUrl } from "../../../../../../lib/canvas-legacy-blob";

export const dynamic = "force-dynamic";

const IMAGE_PATH_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

export async function GET(
  request: Request,
  { params }: { params: { signature: string; source: string } },
) {
  const token = process.env.NEWSLETTER_TRACKING_SECRET?.trim();
  if (!token) return new NextResponse("Image proxy is not configured.", { status: 503 });

  let source = "";
  try {
    source = Buffer.from(params.source, "base64url").toString("utf8");
  } catch {
    return new NextResponse("Invalid image path.", { status: 400 });
  }
  const requestUrl = new URL(request.url);
  const sameOriginPath = source.startsWith("/") && !source.startsWith("//");
  const legacyBlob = isCanvasBlobUrl(source);
  if ((!sameOriginPath && !legacyBlob) || !IMAGE_PATH_RE.test(new URL(source, requestUrl.origin).pathname)) {
    return new NextResponse("Invalid image path.", { status: 400 });
  }

  const expected = createHmac("sha256", token).update(source).digest("hex");
  const supplied = Buffer.from(params.signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (supplied.length !== expectedBytes.length || !timingSafeEqual(supplied, expectedBytes)) {
    return new NextResponse("Invalid image signature.", { status: 403 });
  }

  if (legacyBlob) {
    const downloaded = await downloadLegacyBlobUrl(source);
    if (!downloaded?.buffer.byteLength) return new NextResponse("Image unavailable.", { status: 404 });
    return new NextResponse(downloaded.buffer, {
      status: 200,
      headers: {
        "Content-Type": downloaded.contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    });
  }

  const sourceUrl = new URL(source, requestUrl.origin);
  const response = await fetch(sourceUrl, {
    cache: "force-cache",
    headers: { "x-maroma-newsletter-media": token },
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
    return new NextResponse("Image unavailable.", { status: 404 });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
    },
  });
}
