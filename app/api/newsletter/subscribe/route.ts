import { NextResponse } from "next/server";
import { subscribePublicNewsletter } from "../../../../lib/newsletter-audience-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
      return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
    }
    await subscribePublicNewsletter(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not subscribe.";
    console.error("newsletter subscribe failed", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
