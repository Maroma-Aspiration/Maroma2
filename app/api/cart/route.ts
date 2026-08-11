import { NextResponse } from "next/server";
import {
  addGiftSetToCartServer,
  addToCartServer,
  applyCouponServer,
  buildCartView,
  CartError,
  clearCartServer,
  getOrCreateCart,
  removeCartLineServer,
  removeCouponServer,
  updateCartLineServer,
  writeCart,
} from "../../../lib/commerce-cart";
import { readCartIdFromCookies, setCartIdCookie } from "../../../lib/commerce-cart-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartActionBody = {
  action?: string;
  productId?: string;
  lineId?: string;
  quantity?: number;
  variant?: string;
  delta?: number;
  code?: string;
  boxId?: string;
  elementIds?: string[];
  setName?: string;
  cardId?: string;
  cardMessage?: string;
};

async function withCartCookie<T extends { id: string }>(view: T) {
  setCartIdCookie(view.id);
  return NextResponse.json({ ok: true, cart: view });
}

export async function GET() {
  try {
    const cart = await getOrCreateCart(readCartIdFromCookies());
    await writeCart(cart);
    const view = await buildCartView(cart);
    return withCartCookie(view);
  } catch (error) {
    console.error("cart GET failed", error);
    return NextResponse.json({ error: "Failed to load cart." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: CartActionBody = {};
  try {
    body = (await request.json()) as CartActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  try {
    const existingId = readCartIdFromCookies();
    const cart = await getOrCreateCart(existingId);
    const cartId = cart.id;

    if (action === "add-gift-set") {
      const boxId = typeof body.boxId === "string" ? body.boxId.trim() : "";
      const elementIds = Array.isArray(body.elementIds)
        ? body.elementIds.filter((id): id is string => typeof id === "string")
        : [];
      if (!boxId || elementIds.length === 0) {
        return NextResponse.json({ error: "Missing boxId or elementIds." }, { status: 400 });
      }
      const quantity = typeof body.quantity === "number" ? body.quantity : 1;
      const setName = typeof body.setName === "string" ? body.setName : undefined;
      const cardId = typeof body.cardId === "string" ? body.cardId : undefined;
      const cardMessage = typeof body.cardMessage === "string" ? body.cardMessage : undefined;
      const view = await addGiftSetToCartServer(
        cartId,
        boxId,
        elementIds,
        quantity,
        setName,
        cardId,
        cardMessage
      );
      return withCartCookie(view);
    }

    if (action === "add") {
      const productId = typeof body.productId === "string" ? body.productId.trim() : "";
      if (!productId) {
        return NextResponse.json({ error: "Missing productId." }, { status: 400 });
      }
      const quantity = typeof body.quantity === "number" ? body.quantity : 1;
      const variant = typeof body.variant === "string" ? body.variant : undefined;
      const view = await addToCartServer(cartId, productId, quantity, variant);
      return withCartCookie(view);
    }

    if (action === "update") {
      const lineId = typeof body.lineId === "string" ? body.lineId.trim() : "";
      if (!lineId) {
        return NextResponse.json({ error: "Missing lineId." }, { status: 400 });
      }
      let quantity = typeof body.quantity === "number" ? body.quantity : NaN;
      if (!Number.isFinite(quantity) && typeof body.delta === "number") {
        const current = cart.lines.find((line) => line.id === lineId);
        quantity = (current?.quantity ?? 0) + body.delta;
      }
      if (!Number.isFinite(quantity)) {
        return NextResponse.json({ error: "Missing quantity." }, { status: 400 });
      }
      const view = await updateCartLineServer(cartId, lineId, quantity);
      return withCartCookie(view);
    }

    if (action === "remove") {
      const lineId = typeof body.lineId === "string" ? body.lineId.trim() : "";
      if (!lineId) {
        return NextResponse.json({ error: "Missing lineId." }, { status: 400 });
      }
      const view = await removeCartLineServer(cartId, lineId);
      return withCartCookie(view);
    }

    if (action === "clear") {
      const view = await clearCartServer(cartId);
      return withCartCookie(view);
    }

    if (action === "apply-coupon") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!code) {
        return NextResponse.json({ error: "Missing promo code." }, { status: 400 });
      }
      const view = await applyCouponServer(cartId, code);
      return withCartCookie(view);
    }

    if (action === "remove-coupon") {
      const view = await removeCouponServer(cartId);
      return withCartCookie(view);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    if (error instanceof CartError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("cart POST failed", error);
    return NextResponse.json({ error: "Failed to update cart." }, { status: 500 });
  }
}
