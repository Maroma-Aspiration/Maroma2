import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../../lib/auth-session";
import { readB2bApplications, setB2bApplicationStatus } from "../../../../../lib/b2b-applications-store";
import { suggestB2bSlug, upsertB2bCompany } from "../../../../../lib/b2b-store";
import { provisionAndEmailB2bCompanyWelcome } from "../../../../../lib/b2b-welcome-email";
import { siteOriginFromRequest } from "../../../../../lib/newsletter-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const store = await readB2bApplications();
  return NextResponse.json({ applications: store.applications });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const body = (await request.json().catch(() => ({}))) as { id?: string; action?: string };
  const id = body.id?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  if (body.action === "decline") {
    const application = await setB2bApplicationStatus(id, "declined");
    return NextResponse.json({ application });
  }

  if (body.action !== "approve") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const store = await readB2bApplications();
  const application = store.applications.find((a) => a.id === id);
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const company = await upsertB2bCompany({
    name: application.companyName,
    slug: suggestB2bSlug(application.companyName),
    userEmail: application.email,
    commerceMode: "checkout",
    status: "active",
    program: "white_label",
    whiteLabelDiscountPercent: 35,
    whiteLabelMinSpendInr: 15000,
    notes: `Approved from application ${application.id}. ${application.message}`.slice(0, 500),
    assortment: [],
  });
  const welcomeEmail = await provisionAndEmailB2bCompanyWelcome(company, siteOriginFromRequest(request));
  const updated = await setB2bApplicationStatus(id, "approved");
  return NextResponse.json({ application: updated, company, welcomeEmail });
}
