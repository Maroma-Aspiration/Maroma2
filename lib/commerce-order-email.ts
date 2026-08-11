import { formatInrPrice } from "./format-price";
import { resolveFromEmail, sendEmail } from "./newsletter-send";
import { siteOriginFromRequest } from "./newsletter-send";
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

export function buildOrderConfirmationHtml(order: OrderRecord, origin: string): string {
  const name = escapeHtml(`${order.shipping.firstName} ${order.shipping.lastName}`.trim() || "there");
  const lines = order.lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(line.name)} × ${line.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${formatMoney(line.price * line.quantity)}</td>
        </tr>`
    )
    .join("");

  const address = [
    order.shipping.address,
    order.shipping.city,
    order.shipping.state,
    order.shipping.pincode,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;background:#fafafa">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="max-width:560px">
    <p style="margin:0 0 12px">Hello ${name},</p>
    <p style="margin:0 0 16px">Thank you. We have received your order <strong>${escapeHtml(order.orderNumber)}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">
      ${lines}
      <tr><td style="padding:8px 0">Subtotal</td><td style="padding:8px 0;text-align:right">${formatMoney(order.subtotal)}</td></tr>
      ${
        order.discountAmount > 0
          ? `<tr><td style="padding:8px 0">Discount</td><td style="padding:8px 0;text-align:right">−${formatMoney(order.discountAmount)}</td></tr>`
          : ""
      }
      <tr><td style="padding:8px 0">Shipping</td><td style="padding:8px 0;text-align:right">${order.shippingInr === 0 ? "Complimentary" : formatMoney(order.shippingInr)}</td></tr>
      <tr><td style="padding:12px 0 0;font-weight:600">Total</td><td style="padding:12px 0 0;text-align:right;font-weight:600">${formatMoney(order.total)}</td></tr>
    </table>
    <p style="margin:0 0 8px"><strong>Shipping to</strong><br/>${address}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#555">Prepared with care in Auroville.<br/>Maroma</p>
    <p style="margin:24px 0 0;font-size:12px;color:#888"><a href="${escapeHtml(origin)}/account" style="color:#888">View your account</a></p>
  </td></tr></table>
</body></html>`;
}

export async function sendOrderConfirmationEmail(
  order: OrderRecord,
  request?: Request
): Promise<{ ok: boolean; message?: string }> {
  if (!order.notifications.email) {
    return { ok: true, message: "Email notifications disabled for this order." };
  }
  const from = resolveFromEmail(process.env.ORDER_FROM_EMAIL) || resolveFromEmail();
  if (!from) {
    return { ok: false, message: "ORDER_FROM_EMAIL or NEWSLETTER_FROM_EMAIL not configured." };
  }
  const origin = request ? siteOriginFromRequest(request) : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const html = buildOrderConfirmationHtml(order, origin);
  const result = await sendEmail({
    from,
    to: order.customerEmail,
    subject: `Your Maroma order ${order.orderNumber}`,
    html,
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true };
}
