import { createHmac } from "crypto";

export type RazorpayCreatedOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
};

export function getRazorpayConfig(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function isRazorpayConfigured(): boolean {
  return Boolean(getRazorpayConfig());
}

/** Amount in paise for Razorpay (INR). */
export function inrToPaise(amountInr: number): number {
  return Math.max(100, Math.round(amountInr * 100));
}

export async function createRazorpayOrder(input: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayCreatedOrder> {
  const config = getRazorpayConfig();
  if (!config) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }

  const amount = inrToPaise(input.amountInr);
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
      payment_capture: 1,
    }),
  });

  const data = (await res.json()) as {
    id?: string;
    amount?: number;
    currency?: string;
    receipt?: string;
    error?: { description?: string };
  };

  if (!res.ok || !data.id) {
    throw new Error(data.error?.description || "Could not create Razorpay order.");
  }

  return {
    id: data.id,
    amount: Number(data.amount) || amount,
    currency: data.currency || "INR",
    receipt: data.receipt || input.receipt,
  };
}

export function verifyRazorpayPaymentSignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const config = getRazorpayConfig();
  if (!config) return false;
  const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const expected = createHmac("sha256", config.keySecret).update(payload).digest("hex");
  return expected === input.razorpaySignature;
}
