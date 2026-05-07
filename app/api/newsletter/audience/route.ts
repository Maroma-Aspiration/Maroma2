import { NextResponse } from "next/server";
import {
  countActiveSubscribers,
  readNewsletterAudience,
  summarizeCampaigns,
  mergeNewsletterSubscribers
} from "../../../../lib/newsletter-audience-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await readNewsletterAudience();
    return NextResponse.json({
      activeSubscribers: countActiveSubscribers(state.subscribers),
      totalSubscribers: state.subscribers.length,
      campaigns: summarizeCampaigns(state.campaigns),
      envHints: {
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        trackingSecretConfigured: Boolean(process.env.NEWSLETTER_TRACKING_SECRET),
        siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim())
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to load audience." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { subscribers?: { email: string; name?: string }[] };
    const rows = Array.isArray(body.subscribers) ? body.subscribers : [];
    const { state, added, updated } = await mergeNewsletterSubscribers(rows);
    return NextResponse.json({
      added,
      updated,
      activeSubscribers: countActiveSubscribers(state.subscribers),
      totalSubscribers: state.subscribers.length
    });
  } catch {
    return NextResponse.json({ error: "Unable to merge subscribers." }, { status: 500 });
  }
}
