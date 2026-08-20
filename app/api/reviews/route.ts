import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import {
  addProductReview,
  listAllReviews,
  listPublishedReviews,
  setReviewStatus,
  type ReviewStatus,
} from "../../../lib/reviews-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId")?.trim() ?? "";
  const admin = url.searchParams.get("admin") === "1";
  if (admin) {
    const secret = getSessionSecret();
    const token = cookies().get(SESSION_COOKIE)?.value;
    const session = secret && token ? await verifySessionPayload(token, secret) : null;
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
    }
    return NextResponse.json({ reviews: await listAllReviews() });
  }
  if (!productId) return NextResponse.json({ reviews: [] });
  const reviews = await listPublishedReviews(productId);
  return NextResponse.json({ reviews });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  const isAdmin = session?.role === "admin";

  if (typeof body.reviewId === "string" && typeof body.status === "string") {
    if (!isAdmin) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
    const updated = await setReviewStatus(body.reviewId, body.status as ReviewStatus);
    if (!updated) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    return NextResponse.json({ review: updated });
  }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  if (!productId || !bodyText) {
    return NextResponse.json({ error: "Product and review text are required." }, { status: 400 });
  }
  const review = await addProductReview({
    productId,
    author: typeof body.author === "string" ? body.author : "",
    rating: Number(body.rating),
    body: bodyText,
    source: body.source === "google" ? "google" : "site",
    status: isAdmin && body.status === "published" ? "published" : "pending",
  });
  return NextResponse.json({ review });
}
