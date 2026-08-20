import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../lib/auth-session";
import { appendB2bQuote, getB2bCompanyBySlug } from "../../../../../lib/b2b-store";
import { buildB2bQuoteLines, isWhiteLabelCompany, whiteLabelMinSpendInr } from "../../../../../lib/b2b-pricing";
import { readLiveStorefrontCatalog, readMergedCatalog } from "../../../../../lib/product-catalog-admin";
import { resolveFromEmail, sendEmail } from "../../../../../lib/newsletter-send";

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

  const isOwner = session.email.trim().toLowerCase() === company.userEmail;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Not authorised for this company." }, { status: 403 });
  }

  let body: {
    lines?: { productId?: string; quantity?: number }[];
    message?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const requested = Array.isArray(body.lines) ? body.lines : [];
  if (requested.length === 0) {
    return NextResponse.json({ error: "Add at least one product to the quote." }, { status: 400 });
  }

  const catalog = isWhiteLabelCompany(company)
    ? await readLiveStorefrontCatalog()
    : await readMergedCatalog();
  const { lines, error: lineError } = buildB2bQuoteLines(company, catalog.products, requested);
  if (lineError) {
    return NextResponse.json({ error: lineError }, { status: 400 });
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "No valid assortment lines in the request." }, { status: 400 });
  }

  const subtotalInr = Math.round(lines.reduce((sum, l) => sum + l.lineTotalInr, 0) * 100) / 100;
  const minSpend = whiteLabelMinSpendInr(company);
  if (minSpend > 0 && subtotalInr < minSpend) {
    return NextResponse.json(
      {
        error: `White-label quotes need a minimum of ₹${minSpend.toLocaleString("en-IN")}.`,
        code: "min_spend",
        minSpendInr: minSpend,
        subtotalInr,
      },
      { status: 400 }
    );
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";

  const quote = await appendB2bQuote({
    id: crypto.randomUUID(),
    companyId: company.id,
    companySlug: company.slug,
    companyName: company.name,
    userEmail: session.email.trim().toLowerCase(),
    lines,
    message,
    subtotalInr,
    createdAt: new Date().toISOString(),
    status: "received",
  });

  const from = resolveFromEmail();
  const adminNotify = process.env.B2B_QUOTE_NOTIFY_EMAIL?.trim() || from;
  if (from && adminNotify) {
    const rows = lines
      .map(
        (l) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(l.name)} (${escapeHtml(l.sku)})</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${l.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">₹${l.unitPriceInr.toFixed(2)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">₹${l.lineTotalInr.toFixed(2)}</td></tr>`
      )
      .join("");
    await sendEmail({
      from,
      to: adminNotify,
      subject: `B2B quote request — ${company.name}`,
      html: `<p><strong>${escapeHtml(company.name)}</strong> (${escapeHtml(company.slug)})</p>
<p>From: ${escapeHtml(session.email)}</p>
${message ? `<p>${escapeHtml(message)}</p>` : ""}
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px">
<thead><tr><th align="left">Product</th><th align="left">Qty</th><th align="left">Unit</th><th align="left">Total</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p><strong>Subtotal:</strong> ₹${subtotalInr.toFixed(2)}</p>`,
      forTest: false,
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, quoteId: quote.id, subtotalInr });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
