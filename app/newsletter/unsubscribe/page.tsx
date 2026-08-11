import Link from "next/link";
import { unsubscribeFromSignedToken } from "../../../lib/newsletter-audience-storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Unsubscribe | Maroma Newsletter"
};

export default async function NewsletterUnsubscribePage({
  searchParams
}: {
  searchParams: { t?: string };
}) {
  const token = searchParams.t ?? "";
  const secret = process.env.NEWSLETTER_TRACKING_SECRET?.trim();

  if (!token) {
    return (
      <main className="newsletter-page">
        <section className="newsletter-shell newsletter-unsub-shell">
          <h1 className="newsletter-issue-heading">Invalid link</h1>
          <p className="newsletter-intro">This unsubscribe link is missing a token. Use the link from your email.</p>
          <Link href="/newsletter" className="button secondary">
            Back to newsletter
          </Link>
        </section>
      </main>
    );
  }

  const result = await unsubscribeFromSignedToken(token, secret);

  if (!result.ok && result.reason === "missing_secret") {
    return (
      <main className="newsletter-page">
        <section className="newsletter-shell newsletter-unsub-shell">
          <h1 className="newsletter-issue-heading">Unsubscribe unavailable</h1>
          <p className="newsletter-intro">This site is not configured for email unsubscribe yet.</p>
          <Link href="/newsletter" className="button secondary">
            Newsletter
          </Link>
        </section>
      </main>
    );
  }

  if (!result.ok) {
    return (
      <main className="newsletter-page">
        <section className="newsletter-shell newsletter-unsub-shell">
          <h1 className="newsletter-issue-heading">Link expired or invalid</h1>
          <p className="newsletter-intro">Ask us to remove your email directly if you still receive messages.</p>
          <Link href="/newsletter" className="button secondary">
            Back to newsletter
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="newsletter-page">
      <section className="newsletter-shell newsletter-unsub-shell">
        <h1 className="newsletter-issue-heading">You are unsubscribed</h1>
        <p className="newsletter-intro">
          We removed this address from future newsletter sends. You can still read issues anytime on the site.
        </p>
        <Link href="/newsletter" className="button primary button-sage">
          Open newsletter
        </Link>
      </section>
    </main>
  );
}
