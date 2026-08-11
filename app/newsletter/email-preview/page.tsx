import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import { readStoriesState } from "../../../lib/story-storage";
import EmailPreviewClient from "./email-preview-client";

export default async function EmailPreviewPage() {
  // Auth guard
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || session.role !== "admin") {
    redirect("/login?next=/newsletter/email-preview");
  }

  const state = await readStoriesState();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://maroma-staging-isolated.vercel.app";

  return <EmailPreviewClient initialState={state} siteUrl={siteUrl} />;
}
