import { createCipheriv, createDecipheriv, createHash } from "crypto";
import { siteOriginFromRequest } from "./newsletter-send";
import type { OrderRecord } from "./commerce-types";

const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

export const CCAVENUE_INITIATE_URL =
  "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction";

export type CcavenueConfig = {
  merchantId: string;
  accessCode: string;
  workingKey: string;
};

export type CcavenueCheckoutForm = {
  action: string;
  accessCode: string;
  encRequest: string;
};

export type CcavenueResponse = Record<string, string>;

export function getCcavenueConfig(): CcavenueConfig | null {
  const merchantId = process.env.CCAVENUE_MERCHANT_ID?.trim() || "";
  const accessCode = process.env.CCAVENUE_ACCESS_CODE?.trim() || "";
  const workingKey = process.env.CCAVENUE_WORKING_KEY?.trim() || "";
  if (!merchantId || !accessCode || !workingKey) return null;
  return { merchantId, accessCode, workingKey };
}

export function isCcavenueConfigured(): boolean {
  return Boolean(getCcavenueConfig());
}

function workingKeyBuffer(workingKey: string): Buffer {
  return createHash("md5").update(workingKey, "utf8").digest();
}

export function encryptCcavenue(plainText: string, workingKey: string): string {
  const cipher = createCipheriv("aes-128-cbc", workingKeyBuffer(workingKey), IV);
  return cipher.update(plainText, "utf8", "hex") + cipher.final("hex");
}

export function decryptCcavenue(encText: string, workingKey: string): string {
  const decipher = createDecipheriv("aes-128-cbc", workingKeyBuffer(workingKey), IV);
  return decipher.update(encText, "hex", "utf8") + decipher.final("utf8");
}

function decodeLoose(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function parseCcavenueQuery(decrypted: string): CcavenueResponse {
  const out: CcavenueResponse = {};
  for (const part of decrypted.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    out[decodeLoose(part.slice(0, eq))] = decodeLoose(part.slice(eq + 1));
  }
  return out;
}

function safeField(value: string, max = 100): string {
  return value.replace(/[&=\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function billingPhone(phone: string, country?: string): string {
  const digits = phone.replace(/\D/g, "");
  const india = (country || "India").trim().toLowerCase() === "india";
  if (!india) {
    return digits.slice(-15) || "0000000000";
  }

  let local = digits;
  if (local.startsWith("0091")) local = local.slice(4);
  else if (local.startsWith("91") && local.length >= 12) local = local.slice(2);
  if (local.startsWith("0") && local.length >= 11) local = local.slice(1);
  if (local.length > 10 && /^[6-9]/.test(local)) local = local.slice(0, 10);
  if (local.length > 10) local = local.slice(-10);
  return /^\d{10}$/.test(local) ? local : "0000000000";
}

/** Exact Website URL registered with the maromashopping.com access-code pair. */
export function ccavenueStoreOrigin(): string {
  const configured = process.env.CCAVENUE_STORE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "https://maromashopping.com";
}

export function checkoutOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return ccavenueStoreOrigin();
  }
  return siteOriginFromRequest(request).replace(/\/$/, "");
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function ccavenueAutoSubmitHtml(payment: CcavenueCheckoutForm): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="referrer" content="origin" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Opening secure payment</title>
</head>
<body>
  <p>Opening secure payment…</p>
  <form id="ccavenue" method="post" action="${escapeHtmlAttr(payment.action)}" accept-charset="UTF-8" referrerpolicy="origin">
    <input type="hidden" name="encRequest" value="${escapeHtmlAttr(payment.encRequest)}" />
    <input type="hidden" name="access_code" value="${escapeHtmlAttr(payment.accessCode)}" />
  </form>
  <script>document.getElementById("ccavenue").submit();</script>
</body>
</html>`;
}

export function ccavenueRedirectPath(orderNumber: string): string {
  return `/api/checkout/ccavenue/redirect?order=${encodeURIComponent(orderNumber)}`;
}

export function buildCcavenueCheckoutForm(order: OrderRecord, request: Request): CcavenueCheckoutForm {
  const config = getCcavenueConfig();
  if (!config) {
    throw new Error("CCAvenue is not configured.");
  }

  const callbackUrl = `${ccavenueStoreOrigin()}/api/checkout/ccavenue/callback`;
  const amount = (Math.round(order.total * 100) / 100).toFixed(2);
  const name = safeField(`${order.shipping.firstName} ${order.shipping.lastName}`, 60);
  const params: Record<string, string> = {
    merchant_id: config.merchantId,
    order_id: order.orderNumber,
    currency: "INR",
    amount,
    redirect_url: callbackUrl,
    cancel_url: callbackUrl,
    language: "EN",
    billing_name: name || "Customer",
    billing_address: safeField(order.shipping.address, 150) || "Address on file",
    billing_city: safeField(order.shipping.city, 50) || "City",
    billing_state: safeField(order.shipping.state, 50) || "State",
    billing_zip: safeField(order.shipping.pincode, 15) || "000000",
    billing_country: safeField(order.shipping.country, 50) || "India",
    billing_tel: billingPhone(order.shipping.phone, order.shipping.country),
    billing_email: safeField(order.shipping.email, 70),
    delivery_name: name || "Customer",
    delivery_address: safeField(order.shipping.address, 150) || "Address on file",
    delivery_city: safeField(order.shipping.city, 50) || "City",
    delivery_state: safeField(order.shipping.state, 50) || "State",
    delivery_zip: safeField(order.shipping.pincode, 15) || "000000",
    delivery_country: safeField(order.shipping.country, 50) || "India",
    delivery_tel: billingPhone(order.shipping.phone, order.shipping.country),
    merchant_param1: order.id,
  };

  const plainText = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return {
    action: CCAVENUE_INITIATE_URL,
    accessCode: config.accessCode,
    encRequest: encryptCcavenue(plainText, config.workingKey),
  };
}

export function amountsMatch(orderTotal: number, paidAmount: string): boolean {
  const paid = Number.parseFloat(paidAmount);
  if (!Number.isFinite(paid)) return false;
  return Math.round(orderTotal * 100) === Math.round(paid * 100);
}
