import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../lib/auth-session";
import { appendB2bOrder, getB2bCompanyBySlug } from "../../../../../lib/b2b-store";
import type { B2bDeliveryAddress } from "../../../../../lib/b2b-types";
import { buildB2bQuoteLines, isWhiteLabelCompany, whiteLabelMinSpendInr } from "../../../../../lib/b2b-pricing";
import { resolveFromEmail, sendEmail } from "../../../../../lib/newsletter-send";
import { readLiveStorefrontCatalog, readMergedCatalog } from "../../../../../lib/product-catalog-admin";
import {
  createRazorpayOrder,
  getRazorpayConfig,
  isRazorpayConfigured,
} from "../../../../../lib/razorpay";

type Ctx = { params: { slug: string } };

export async function POST(request: Request, ctx: Ctx) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const company = await getB2bCompanyBySlug(ctx.params.slug);
  if (!company || company.status !== "active") {
    return NextResponse.json({ error: "B2B page not available." }, { status: 404 });
  }
  if (company.commerceMode !== "checkout") {
    return NextResponse.json(
      { error: "This company is set to quote mode. Submit a quote request instead." },
      { status: 400 }
    );
  }

  const isOwner = session.email.trim().toLowerCase() === company.userEmail;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Not authorised for this company." }, { status: 403 });
  }

  let body: {
    lines?: { productId?: string; quantity?: number }[];
    message?: string;
    deliveryAddressId?: string;
    paymentMode?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const paymentMode = body.paymentMode === "pay_now" ? "pay_now" : "invoice";
  if (paymentMode === "pay_now" && !isRazorpayConfigured()) {
    return NextResponse.json(
      {
        error:
          "Online payment is not configured yet. Use Place order for invoice, or ask Maroma to enable Razorpay.",
        code: "razorpay_not_configured",
      },
      { status: 503 }
    );
  }

  const addressId =
    typeof body.deliveryAddressId === "string" ? body.deliveryAddressId.trim() : "";
  const deliveryAddress = company.deliveryAddresses.find((a) => a.id === addressId);
  if (!deliveryAddress) {
    return NextResponse.json(
      { error: "Choose a delivery address. Add one below if none are saved yet." },
      { status: 400 }
    );
  }

  const requested = Array.isArray(body.lines) ? body.lines : [];
  if (requested.length === 0) {
    return NextResponse.json({ error: "Add at least one product to the order." }, { status: 400 });
  }

  const catalog = isWhiteLabelCompany(company)
    ? await readLiveStorefrontCatalog()
    : await readMergedCatalog();
  const { lines, error: lineError } = buildB2bQuoteLines(company, catalog.products, requested);
  if (lineError) {
    return NextResponse.json({ error: lineError }, { status: 400 });
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "No valid assortment lines in the order." }, { status: 400 });
  }

  const subtotalInr = Math.round(lines.reduce((sum, l) => sum + l.lineTotalInr, 0) * 100) / 100;
  const minSpend = whiteLabelMinSpendInr(company);
  if (minSpend > 0 && subtotalInr < minSpend) {
    return NextResponse.json(
      {
        error: `White-label orders need a minimum of ₹${minSpend.toLocaleString("en-IN")} before checkout.`,
        code: "min_spend",
        minSpendInr: minSpend,
        subtotalInr,
      },
      { status: 400 }
    );
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const snapshot: B2bDeliveryAddress = { ...deliveryAddress };
  const orderId = crypto.randomUUID();

  let razorpay: { orderId: string; amount: number; currency: string; keyId: string } | undefined;
  if (paymentMode === "pay_now") {
    const config = getRazorpayConfig();
    if (!config) {
      return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503 });
    }
    try {
      const rzp = await createRazorpayOrder({
        amountInr: subtotalInr,
        receipt: `b2b_${orderId.replace(/-/g, "").slice(0, 32)}`,
        notes: {
          b2bOrderId: orderId,
          companySlug: company.slug,
          companyName: company.name,
        },
      });
      razorpay = {
        orderId: rzp.id,
        amount: rzp.amount,
        currency: rzp.currency,
        keyId: config.keyId,
      };
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not start payment." },
        { status: 502 }
      );
    }
  }

  const order = await appendB2bOrder({
    id: orderId,
    companyId: company.id,
    companySlug: company.slug,
    companyName: company.name,
    userEmail: session.email.trim().toLowerCase(),
    lines,
    message,
    subtotalInr,
    deliveryAddress: snapshot,
    createdAt: new Date().toISOString(),
    status: paymentMode === "pay_now" ? "awaiting_payment" : "received",
    paymentMode,
    payment:
      paymentMode === "pay_now" && razorpay
        ? { provider: "razorpay", razorpayOrderId: razorpay.orderId }
        : undefined,
  });

  const from = resolveFromEmail();
  const adminNotify = process.env.B2B_QUOTE_NOTIFY_EMAIL?.trim() || from;
  if (from && adminNotify && paymentMode === "invoice") {
    const rows = lines
      .map(
        (l) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(l.name)} (${escapeHtml(l.sku)})</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${l.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">₹${l.unitPriceInr.toFixed(2)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">₹${l.lineTotalInr.toFixed(2)}</td></tr>`
      )
      .join("");
    const addr = snapshot;
    await sendEmail({
      from,
      to: adminNotify,
      subject: `B2B order — ${company.name}`,
      html: `<p><strong>${escapeHtml(company.name)}</strong> (${escapeHtml(company.slug)})</p>
<p>From: ${escapeHtml(session.email)}</p>
<p><strong>Deliver to:</strong> ${escapeHtml(addr.label)} — ${escapeHtml(addr.contactName)}, ${escapeHtml(addr.phone)}<br/>
${escapeHtml(addr.address)}, ${escapeHtml(addr.city)}${addr.state ? `, ${escapeHtml(addr.state)}` : ""} ${escapeHtml(addr.pincode)}, ${escapeHtml(addr.country)}</p>
${message ? `<p>${escapeHtml(message)}</p>` : ""}
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px">
<thead><tr><th align="left">Product</th><th align="left">Qty</th><th align="left">Unit</th><th align="left">Total</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p><strong>Subtotal:</strong> ₹${subtotalInr.toFixed(2)}</p>
<p>Status: received (invoice / payment to follow)</p>`,
      forTest: false,
    }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    subtotalInr,
    paymentMode,
    status: order.status,
    razorpay: razorpay
      ? {
          keyId: razorpay.keyId,
          orderId: razorpay.orderId,
          amount: razorpay.amount,
          currency: razorpay.currency,
          name: "Maroma B2B",
          description: `${company.name} wholesale order`,
          prefill: {
            email: session.email,
            contact: snapshot.phone,
            name: snapshot.contactName,
          },
        }
      : undefined,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
