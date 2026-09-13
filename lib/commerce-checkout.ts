import {
  buildCartView,
  CartError,
  clearCartServer,
  readCart,
} from "./commerce-cart";
import { createOrder, getOrderById, updateOrderStatus } from "./commerce-orders";
import { sendOrderConfirmationEmail } from "./commerce-order-email";
import { decrementStockForOrder } from "./commerce-stock";
import { normalizeIndianPincode, pincodeValidationMessage } from "./indian-pincode";
import type { OrderRecord, ShippingAddress } from "./commerce-types";
import { matchingRestrictions, readShippingRestrictions } from "./shipping-restrictions";

export type CheckoutInput = {
  cartId: string;
  shipping: ShippingAddress;
  notifications: { email: boolean; whatsapp: boolean };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateShippingAddress(shipping: ShippingAddress): string | null {
  const email = shipping.email.trim();
  if (!email || !EMAIL_RE.test(email)) {
    return "Enter a valid email address.";
  }
  const phone = shipping.phone.replace(/\D/g, "");
  if (phone.length < 10) {
    return "Enter a valid phone number.";
  }
  if (!shipping.firstName.trim()) return "First name is required.";
  if (!shipping.lastName.trim()) return "Last name is required.";
  if (!shipping.address.trim()) return "Shipping address is required.";
  if (!shipping.city.trim()) return "City is required.";
  if (!shipping.country.trim()) return "Country is required.";
  if (shipping.country.trim().toLowerCase() === "india") {
    const pincodeError = pincodeValidationMessage(shipping.pincode);
    if (pincodeError) return pincodeError;
  } else if (!shipping.pincode.trim()) {
    return "Postal code is required.";
  }
  return null;
}

export async function createOrderFromCart(
  input: CheckoutInput,
  request?: Request
): Promise<OrderRecord> {
  const validationError = validateShippingAddress(input.shipping);
  if (validationError) {
    throw new CartError(validationError, 400);
  }

  const cart = await readCart(input.cartId);
  const view = await buildCartView(cart);
  if (view.items.length === 0) {
    throw new CartError("Your basket is empty.", 400);
  }
  const restrictions = await readShippingRestrictions();
  const matched = matchingRestrictions(restrictions, [input.shipping.country, input.shipping.state, input.shipping.city], view.items.map((item) => item.productId), view.items.filter((item) => item.ukAndChannelIslandsRestricted).map((item) => item.productId));
  if (matched.length) throw new CartError("One or more items in your basket cannot be delivered to this destination. Please remove them or use another delivery address.", 400);

  for (const item of view.items) {
    if (item.quantity > item.maxQuantity) {
      throw new CartError(`${item.name} is no longer available in the requested quantity.`, 409);
    }
  }

  const order = await createOrder({
    status: "pending_payment",
    cartId: cart.id,
    customerEmail: input.shipping.email.trim().toLowerCase(),
    shipping: {
      ...input.shipping,
      email: input.shipping.email.trim().toLowerCase(),
      phone: input.shipping.phone.trim(),
      firstName: input.shipping.firstName.trim(),
      lastName: input.shipping.lastName.trim(),
      address: input.shipping.address.trim(),
      city: input.shipping.city.trim(),
      pincode: normalizeIndianPincode(input.shipping.pincode),
      state: input.shipping.state.trim(),
      country: input.shipping.country.trim(),
    },
    lines: view.items.map((item) => ({
      productId: item.productId,
      sku: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      variant: item.variant,
    })),
    subtotal: view.subtotal,
    discountRate: view.discountRate,
    discountAmount: view.discountAmount,
    couponCode: view.couponCode,
    shippingInr: view.shipping,
    total: view.total,
    notifications: input.notifications,
  });

  const { isCcavenueConfigured } = await import("./ccavenue");
  if (!isCcavenueConfigured()) {
    await clearCartServer(cart.id);
    const { sendProductionInstructionEmail } = await import("./commerce-production-email");
    const productionEmail = await sendProductionInstructionEmail(order, request);
    if (!productionEmail.ok) {
      console.warn("Production instruction email failed:", productionEmail.message);
    }
  }

  return order;
}

/** Called after Razorpay payment succeeds (or manual admin mark-paid). */
export async function markOrderPaid(
  orderId: string,
  payment?: OrderRecord["payment"],
  request?: Request
): Promise<OrderRecord> {
  const order = await getOrderById(orderId);
  if (!order) {
    throw new CartError("Order not found.", 404);
  }
  if (order.status === "paid" || order.status === "fulfilled") {
    return order;
  }
  if (order.status === "cancelled") {
    throw new CartError("Cancelled orders cannot be marked paid.", 409);
  }

  await decrementStockForOrder(order.lines);
  if (order.cartId) {
    await clearCartServer(order.cartId);
  }
  const updated = await updateOrderStatus(orderId, "paid", {
    payment: {
      provider: payment?.provider ?? order.payment?.provider ?? "razorpay",
      ...order.payment,
      ...payment,
      paidAt: payment?.paidAt ?? new Date().toISOString(),
    },
  });
  if (!updated) {
    throw new CartError("Failed to update order.", 500);
  }

  const { sendProductionInstructionEmail } = await import("./commerce-production-email");
  const productionEmail = await sendProductionInstructionEmail(updated, request);
  if (!productionEmail.ok) {
    console.warn("Production instruction email failed:", productionEmail.message);
  }

  const emailResult = await sendOrderConfirmationEmail(updated, request);
  if (!emailResult.ok) {
    console.warn("Order confirmation email failed:", emailResult.message);
  }

  return updated;
}
