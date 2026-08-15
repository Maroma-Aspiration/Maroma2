import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../../lib/auth-session";
import {
  getB2bCompanyBySlug,
  getB2bOrderById,
  updateB2bOrder,
} from "../../../../../../lib/b2b-store";
import { resolveFromEmail, sendEmail } from "../../../../../../lib/newsletter-send";
import { verifyRazorpayPaymentSignature } from "../../../../../../lib/razorpay";

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
    orderId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const razorpayOrderId =
    typeof body.razorpayOrderId === "string" ? body.razorpayOrderId.trim() : "";
  const razorpayPaymentId =
    typeof body.razorpayPaymentId === "string" ? body.razorpayPaymentId.trim() : "";
  const razorpaySignature =
    typeof body.razorpaySignature === "string" ? body.razorpaySignature.trim() : "";

  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json({ error: "Missing payment confirmation fields." }, { status: 400 });
  }

  const order = await getB2bOrderById(orderId);
  if (!order || order.companyId !== company.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.status === "paid" || order.status === "confirmed" || order.status === "fulfilled") {
    return NextResponse.json({ ok: true, orderId: order.id, status: order.status, alreadyPaid: true });
  }
  if (order.payment?.razorpayOrderId && order.payment.razorpayOrderId !== razorpayOrderId) {
    return NextResponse.json({ error: "Payment does not match this order." }, { status: 400 });
  }

  const valid = verifyRazorpayPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
  }

  const updated = await updateB2bOrder(orderId, {
    status: "paid",
    payment: {
      provider: "razorpay",
      razorpayOrderId,
      razorpayPaymentId,
      paidAt: new Date().toISOString(),
    },
  });
  if (!updated) {
    return NextResponse.json({ error: "Could not update order." }, { status: 500 });
  }

  const from = resolveFromEmail();
  const adminNotify = process.env.B2B_QUOTE_NOTIFY_EMAIL?.trim() || from;
  if (from && adminNotify) {
    const addr = updated.deliveryAddress;
    await sendEmail({
      from,
      to: adminNotify,
      subject: `B2B payment received — ${updated.companyName}`,
      html: `<p><strong>${escapeHtml(updated.companyName)}</strong> paid online.</p>
<p>Order: ${escapeHtml(updated.id)}</p>
<p>Amount: ₹${updated.subtotalInr.toFixed(2)}</p>
<p>Razorpay payment: ${escapeHtml(razorpayPaymentId)}</p>
<p>From: ${escapeHtml(updated.userEmail)}</p>
<p>Deliver to: ${escapeHtml(addr.label)} — ${escapeHtml(addr.contactName)}, ${escapeHtml(addr.phone)}<br/>
${escapeHtml(addr.address)}, ${escapeHtml(addr.city)}${addr.state ? `, ${escapeHtml(addr.state)}` : ""} ${escapeHtml(addr.pincode)}</p>`,
      forTest: false,
    }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    orderId: updated.id,
    status: updated.status,
    subtotalInr: updated.subtotalInr,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
