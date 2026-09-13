import { NextResponse } from "next/server";
import { CartError } from "../../../lib/commerce-cart";
import { createOrderFromCart } from "../../../lib/commerce-checkout";
import { readCartIdFromCookies } from "../../../lib/commerce-cart-cookie";
import { getOrCreateCart } from "../../../lib/commerce-cart";
import { buildCcavenueCheckoutForm, isCcavenueConfigured } from "../../../lib/ccavenue";
import type { ShippingAddress } from "../../../lib/commerce-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  shipping?: Partial<ShippingAddress>;
  notifications?: { email?: boolean; whatsapp?: boolean };
};

export async function POST(request: Request) {
  let body: CheckoutBody = {};
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const shippingRaw = body.shipping ?? {};
  const shipping: ShippingAddress = {
    email: typeof shippingRaw.email === "string" ? shippingRaw.email : "",
    phone: typeof shippingRaw.phone === "string" ? shippingRaw.phone : "",
    firstName: typeof shippingRaw.firstName === "string" ? shippingRaw.firstName : "",
    lastName: typeof shippingRaw.lastName === "string" ? shippingRaw.lastName : "",
    address: typeof shippingRaw.address === "string" ? shippingRaw.address : "",
    city: typeof shippingRaw.city === "string" ? shippingRaw.city : "",
    pincode: typeof shippingRaw.pincode === "string" ? shippingRaw.pincode : "",
    state: typeof shippingRaw.state === "string" ? shippingRaw.state : "",
    country: typeof shippingRaw.country === "string" ? shippingRaw.country : "India",
  };

  const notifications = {
    email: body.notifications?.email !== false,
    whatsapp: body.notifications?.whatsapp === true,
  };

  try {
    const cartId = readCartIdFromCookies();
    const cart = await getOrCreateCart(cartId);
    const order = await createOrderFromCart({ cartId: cart.id, shipping, notifications }, request);
    const payment = isCcavenueConfigured() ? buildCcavenueCheckoutForm(order, request) : null;

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        shippingInr: order.shippingInr,
        customerEmail: order.customerEmail,
      },
      payment,
    });
  } catch (error) {
    if (error instanceof CartError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("checkout POST failed", error);
    return NextResponse.json({ error: "Checkout failed." }, { status: 500 });
  }
}
