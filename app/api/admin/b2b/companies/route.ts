import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../lib/auth-session";
import {
  deleteB2bCompany,
  getB2bCompanyById,
  listB2bCompanies,
  listB2bOrders,
  listB2bQuotes,
  suggestB2bSlug,
  upsertB2bCompany,
} from "../../../../../lib/b2b-store";
import type { B2bAssortmentItem, B2bCommerceMode, B2bCompanyStatus } from "../../../../../lib/b2b-types";
import { provisionAndEmailB2bCompanyWelcome } from "../../../../../lib/b2b-welcome-email";
import { siteOriginFromRequest } from "../../../../../lib/newsletter-send";

async function requireAdmin() {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || session.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin sign-in required." }, { status: 401 }) };
  }
  return { session };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const [companies, quotes, orders] = await Promise.all([
    listB2bCompanies(),
    listB2bQuotes(40),
    listB2bOrders(40),
  ]);
  return NextResponse.json({ companies, quotes, orders });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slugRaw = typeof body.slug === "string" && body.slug.trim() ? body.slug : suggestB2bSlug(name);
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  const commerceMode =
    body.commerceMode === "checkout" ? ("checkout" as B2bCommerceMode) : ("quote" as B2bCommerceMode);
  const status =
    body.status === "pending" || body.status === "paused" || body.status === "active"
      ? (body.status as B2bCompanyStatus)
      : "active";
  const isUpdate = typeof body.id === "string" && Boolean(body.id.trim());
  const sendWelcome =
    body.sendWelcomeEmail === true || (!isUpdate && body.sendWelcomeEmail !== false);

  try {
    const company = await upsertB2bCompany({
      id: typeof body.id === "string" ? body.id : undefined,
      name,
      slug: slugRaw,
      userEmail,
      commerceMode,
      status,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      assortment: Array.isArray(body.assortment) ? (body.assortment as B2bAssortmentItem[]) : undefined,
    });

    let welcomeEmail: Awaited<ReturnType<typeof provisionAndEmailB2bCompanyWelcome>> | undefined;
    if (sendWelcome) {
      welcomeEmail = await provisionAndEmailB2bCompanyWelcome(
        company,
        siteOriginFromRequest(request)
      );
    }

    return NextResponse.json({ company, welcomeEmail });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save company." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  const existing = await getB2bCompanyById(id);
  if (!existing) return NextResponse.json({ error: "Company not found." }, { status: 404 });
  await deleteB2bCompany(id);
  return NextResponse.json({ ok: true });
}
