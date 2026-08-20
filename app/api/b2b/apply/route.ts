import { NextResponse } from "next/server";
import { submitB2bApplication } from "../../../../lib/b2b-applications-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const application = await submitB2bApplication({
      companyName: typeof body.companyName === "string" ? body.companyName : "",
      contactName: typeof body.contactName === "string" ? body.contactName : "",
      email: typeof body.email === "string" ? body.email : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      country: typeof body.country === "string" ? body.country : "",
      website: typeof body.website === "string" ? body.website : "",
      message: typeof body.message === "string" ? body.message : "",
    });
    return NextResponse.json({ ok: true, id: application.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not submit application." },
      { status: 400 }
    );
  }
}
