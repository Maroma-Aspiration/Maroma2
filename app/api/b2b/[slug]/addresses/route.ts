import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../lib/auth-session";
import {
  getB2bCompanyBySlug,
  setB2bCompanyDeliveryAddresses,
} from "../../../../../lib/b2b-store";
import type { B2bDeliveryAddress } from "../../../../../lib/b2b-types";

type Ctx = { params: { slug: string } };

async function authorize(slug: string) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  const company = await getB2bCompanyBySlug(slug);
  if (!company || company.status === "pending") {
    return { error: NextResponse.json({ error: "B2B page not found." }, { status: 404 }) };
  }
  if (company.status === "paused" && session.role !== "admin") {
    return { error: NextResponse.json({ error: "This B2B page is temporarily paused." }, { status: 403 }) };
  }
  const isOwner = session.email.trim().toLowerCase() === company.userEmail;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return { error: NextResponse.json({ error: "Not authorised for this company." }, { status: 403 }) };
  }
  return { session, company };
}

function parseAddress(raw: unknown, fallbackId?: string): B2bDeliveryAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const label = typeof row.label === "string" ? row.label.trim() : "";
  const contactName = typeof row.contactName === "string" ? row.contactName.trim() : "";
  const phone = typeof row.phone === "string" ? row.phone.trim() : "";
  const address = typeof row.address === "string" ? row.address.trim() : "";
  const city = typeof row.city === "string" ? row.city.trim() : "";
  const state = typeof row.state === "string" ? row.state.trim() : "";
  const pincode = typeof row.pincode === "string" ? row.pincode.trim() : "";
  const country =
    typeof row.country === "string" && row.country.trim() ? row.country.trim() : "India";
  if (!label || !contactName || !phone || !address || !city || !pincode) return null;
  return {
    id:
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim()
        : fallbackId || crypto.randomUUID(),
    label,
    contactName,
    phone,
    address,
    city,
    state,
    pincode,
    country,
    isDefault: row.isDefault === true,
  };
}

export async function PUT(request: Request, ctx: Ctx) {
  const auth = await authorize(ctx.params.slug);
  if ("error" in auth && auth.error) return auth.error;

  let body: { addresses?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const list = Array.isArray(body.addresses) ? body.addresses : null;
  if (!list) {
    return NextResponse.json({ error: "addresses array required." }, { status: 400 });
  }
  if (list.length > 20) {
    return NextResponse.json({ error: "Maximum 20 delivery addresses." }, { status: 400 });
  }

  const addresses: B2bDeliveryAddress[] = [];
  for (const item of list) {
    const parsed = parseAddress(item);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Each address needs a label, contact name, phone, street address, city, and pincode.",
        },
        { status: 400 }
      );
    }
    addresses.push(parsed);
  }

  try {
    const company = await setB2bCompanyDeliveryAddresses(auth.company.id, addresses);
    return NextResponse.json({ ok: true, deliveryAddresses: company.deliveryAddresses });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save addresses." },
      { status: 400 }
    );
  }
}
