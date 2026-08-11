import {
  countGiftSetsToMake,
  expandOrderGiftSets,
  giftSetCategoryLabel,
  orderHasGiftSets,
} from "./gift-set-production";
import { formatInrPrice } from "./format-price";
import { resolveFromEmail, sendEmail, siteOriginFromRequest } from "./newsletter-send";
import type { OrderRecord } from "./commerce-types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount: number): string {
  return formatInrPrice(String(amount)) ?? `₹${amount.toLocaleString("en-IN")}`;
}

function resolveProductionEmail(): string | null {
  const direct = process.env.ORDER_PRODUCTION_EMAIL?.trim();
  if (direct && direct.includes("@")) return direct;
  return resolveFromEmail(process.env.ORDER_FROM_EMAIL) || resolveFromEmail();
}

export function buildProductionInstructionHtml(order: OrderRecord, origin: string): string {
  const giftSets = expandOrderGiftSets(order);
  const setsToMake = countGiftSetsToMake(giftSets);
  const sheetUrl = `${origin.replace(/\/$/, "")}/admin/orders/${order.id}/production`;
  const printUrl = `${sheetUrl}?print=1`;

  const customerName = escapeHtml(
    `${order.shipping.firstName} ${order.shipping.lastName}`.trim() || "Customer"
  );
  const address = [
    order.shipping.address,
    order.shipping.city,
    order.shipping.state,
    order.shipping.pincode,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");

  const giftSetBlocks = giftSets
    .map((set) => {
      const elementRows = set.elements
        .map(
          (el) =>
            `<li><strong>Slot ${el.slot}</strong> · ${escapeHtml(giftSetCategoryLabel(el.category))} · ${escapeHtml(el.name)} <span style="color:#666">(SKU ${escapeHtml(el.sku)})</span></li>`
        )
        .join("");

      const cardBlock = set.card
        ? `<div style="margin:12px 0;padding:12px;border:2px dashed #134a57;border-radius:8px;background:#f8faf9">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#134a57">Handwrite greeting card · ${escapeHtml(set.card.name)}</p>
            <p style="margin:0;font-size:16px;line-height:1.5;font-style:italic">"${escapeHtml(set.card.message)}"</p>
          </div>`
        : `<p style="margin:8px 0 0;color:#666">No greeting card for this set.</p>`;

      const copies = Array.from({ length: set.quantity }, (_, copyIndex) => {
        const copyLabel = set.quantity > 1 ? ` (copy ${copyIndex + 1} of ${set.quantity})` : "";
        return `<div style="margin:16px 0;padding:14px;border:1px solid #ddd;border-radius:8px;background:#fff">
          <h3 style="margin:0 0 8px;font-size:16px">${escapeHtml(set.setName)}${copyLabel}</h3>
          <p style="margin:0 0 8px"><strong>Box:</strong> ${escapeHtml(set.box.name)} (${set.box.slotCount} slots) · ${formatMoney(set.unitPrice)} each</p>
          <ol style="margin:0 0 8px;padding-left:20px">${elementRows}</ol>
          ${cardBlock}
        </div>`;
      }).join("");

      return copies;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;background:#fafafa">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="max-width:640px">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#134a57">Production instructions</p>
    <h1 style="margin:0 0 12px;font-size:22px">Order ${escapeHtml(order.orderNumber)}</h1>
    <p style="margin:0 0 16px">${setsToMake} gift set${setsToMake === 1 ? "" : "s"} to prepare · Status: <strong>${escapeHtml(order.status.replace("_", " "))}</strong></p>

    <div style="margin:0 0 20px;padding:14px;border-radius:8px;background:#fff;border:1px solid #ddd">
      <p style="margin:0 0 6px"><strong>Ship to</strong> ${customerName}</p>
      <p style="margin:0 0 6px">${address}</p>
      <p style="margin:0 0 6px">Phone: ${escapeHtml(order.shipping.phone)} · Email: ${escapeHtml(order.shipping.email)}</p>
      <p style="margin:0">Order total: <strong>${formatMoney(order.total)}</strong></p>
    </div>

    ${giftSetBlocks}

    <p style="margin:20px 0 0">
      <a href="${escapeHtml(sheetUrl)}" style="display:inline-block;margin-right:12px;padding:10px 16px;background:#134a57;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Open production sheet</a>
      <a href="${escapeHtml(printUrl)}" style="display:inline-block;padding:10px 16px;background:#eee;color:#111;text-decoration:none;border-radius:6px;font-weight:600">Print / save PDF</a>
    </p>
  </td></tr></table>
</body></html>`;
}

export async function sendProductionInstructionEmail(
  order: OrderRecord,
  request?: Request
): Promise<{ ok: boolean; message?: string }> {
  if (!orderHasGiftSets(order)) {
    return { ok: true, message: "No gift sets in order." };
  }

  const to = resolveProductionEmail();
  if (!to) {
    return { ok: false, message: "ORDER_PRODUCTION_EMAIL or ORDER_FROM_EMAIL not configured." };
  }

  const from = resolveFromEmail(process.env.ORDER_FROM_EMAIL) || resolveFromEmail();
  if (!from) {
    return { ok: false, message: "ORDER_FROM_EMAIL or NEWSLETTER_FROM_EMAIL not configured." };
  }

  const origin = request ? siteOriginFromRequest(request) : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const giftSets = expandOrderGiftSets(order);
  const setsToMake = countGiftSetsToMake(giftSets);
  const html = buildProductionInstructionHtml(order, origin);

  const result = await sendEmail({
    from,
    to,
    subject: `[Production] ${order.orderNumber} · ${setsToMake} gift set${setsToMake === 1 ? "" : "s"} to make`,
    html,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true };
}
