import { NextResponse } from "next/server";
import {
  buildCcavenueCheckoutForm,
  ccavenueAutoSubmitHtml,
  ccavenueStoreOrigin,
  isCcavenueConfigured,
} from "../../../../../lib/ccavenue";
import { getOrderById, getOrderByNumber } from "../../../../../lib/commerce-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function completeRedirect(orderNumber: string, status: string) {
  const params = new URLSearchParams({ order: orderNumber, status });
  return NextResponse.redirect(`${ccavenueStoreOrigin()}/checkout/complete?${params.toString()}`, 303);
}

export async function GET(request: Request) {
  if (!isCcavenueConfigured()) {
    return completeRedirect("", "unavailable");
  }

  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const storeHost = new URL(ccavenueStoreOrigin()).host;
  if (host && host !== storeHost && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    const dest = new URL(ccavenueStoreOrigin());
    dest.pathname = "/api/checkout/ccavenue/redirect";
    dest.search = url.search;
    return NextResponse.redirect(dest, 302);
  }

  const orderRef = url.searchParams.get("order")?.trim() || "";
  if (!orderRef) {
    return completeRedirect("", "failed");
  }

  const order = (await getOrderByNumber(orderRef)) || (await getOrderById(orderRef));
  if (!order || order.status !== "pending_payment") {
    return completeRedirect(order?.orderNumber || orderRef, order?.status === "paid" ? "success" : "failed");
  }

  const html = ccavenueAutoSubmitHtml(buildCcavenueCheckoutForm(order, request));
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "origin",
    },
  });
}
