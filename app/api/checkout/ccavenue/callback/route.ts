import { NextResponse } from "next/server";
import {
  amountsMatch,
  checkoutOrigin,
  decryptCcavenue,
  getCcavenueConfig,
  parseCcavenueQuery,
} from "../../../../../lib/ccavenue";
import { markOrderPaid } from "../../../../../lib/commerce-checkout";
import { getOrderById, getOrderByNumber } from "../../../../../lib/commerce-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readEncResp(request: Request): Promise<string> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("encResp")?.trim() || "";
  if (request.method === "GET") return fromQuery;
  try {
    const form = await request.formData();
    const fromForm = String(form.get("encResp") || "").trim();
    return fromForm || fromQuery;
  } catch {
    return fromQuery;
  }
}

function completeUrl(request: Request, orderNumber: string, status: string): string {
  const origin = checkoutOrigin(request);
  const params = new URLSearchParams({
    order: orderNumber,
    status,
  });
  return `${origin}/checkout/complete?${params.toString()}`;
}

function redirectTo(request: Request, orderNumber: string, status: string) {
  return NextResponse.redirect(completeUrl(request, orderNumber, status), 303);
}

async function handleCallback(request: Request): Promise<NextResponse> {
  const config = getCcavenueConfig();
  if (!config) {
    return redirectTo(request, "", "unavailable");
  }

  const encResp = await readEncResp(request);
  if (!encResp) {
    return redirectTo(request, "", "failed");
  }

  let parsed: Record<string, string> = {};
  try {
    parsed = parseCcavenueQuery(decryptCcavenue(encResp, config.workingKey));
  } catch {
    return redirectTo(request, "", "failed");
  }

  const orderNumber = parsed.order_id?.trim() || "";
  const orderId = parsed.merchant_param1?.trim() || "";
  const order = orderId ? await getOrderById(orderId) : orderNumber ? await getOrderByNumber(orderNumber) : null;
  const displayNumber = order?.orderNumber || orderNumber;
  const status = (parsed.order_status || "").toLowerCase();

  if (!order) {
    return redirectTo(request, displayNumber, "failed");
  }

  if (status === "success") {
    if (!amountsMatch(order.total, parsed.amount || "")) {
      return redirectTo(request, displayNumber, "failed");
    }
    try {
      await markOrderPaid(
        order.id,
        {
          provider: "ccavenue",
          orderId: parsed.order_id,
          paymentId: parsed.bank_ref_no,
          trackingId: parsed.tracking_id,
          paidAt: new Date().toISOString(),
        },
        request
      );
    } catch {
      return redirectTo(request, displayNumber, "failed");
    }
    return redirectTo(request, displayNumber, "success");
  }

  if (status === "aborted") {
    return redirectTo(request, displayNumber, "aborted");
  }

  return redirectTo(request, displayNumber, "failed");
}

export async function GET(request: Request) {
  return handleCallback(request);
}

export async function POST(request: Request) {
  return handleCallback(request);
}
