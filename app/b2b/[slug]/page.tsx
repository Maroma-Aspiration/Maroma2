import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import { getB2bCompanyBySlug } from "../../../lib/b2b-store";
import B2bPortalClient from "./b2b-portal-client";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const company = await getB2bCompanyBySlug(params.slug);
  return {
    title: company ? `${company.name} | Maroma B2B` : "B2B | Maroma",
    robots: { index: false, follow: false },
  };
}

export default async function B2bPortalPage({ params }: Props) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!secret || !token) {
    redirect(`/login?next=${encodeURIComponent(`/b2b/${params.slug}`)}&reason=sign_in_required`);
  }
  const session = await verifySessionPayload(token, secret);
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/b2b/${params.slug}`)}&reason=sign_in_required`);
  }

  const company = await getB2bCompanyBySlug(params.slug);
  if (!company || company.status === "pending") {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1 className="login-title">Page not found</h1>
          <p className="login-reason">This B2B page does not exist or is not ready yet.</p>
        </section>
      </main>
    );
  }

  const isOwner = session.email.trim().toLowerCase() === company.userEmail;
  const isAdmin = session.role === "admin";
  if (!isOwner && !isAdmin) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1 className="login-title">Private page</h1>
          <p className="login-reason">
            Signed in as <strong>{session.email}</strong>. This page is linked to a different business
            account. Contact Maroma if you need access.
          </p>
        </section>
      </main>
    );
  }

  if (company.status === "paused" && !isAdmin) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1 className="login-title">Temporarily paused</h1>
          <p className="login-reason">This wholesale page is paused. Please contact Maroma.</p>
        </section>
      </main>
    );
  }

  return <B2bPortalClient slug={params.slug} />;
}
