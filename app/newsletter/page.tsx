import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../lib/auth-session";
import { readStoriesState } from "../../lib/story-storage";
import NewsletterPageClient from "./newsletter-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Maroma Newsletter",
  description: "Beautifully formatted Maroma newsletter generated from latest stories."
};

export default async function NewsletterPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const state = await readStoriesState();
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  const isAdmin = session?.role === "admin";
  const params = (await searchParams) ?? {};
  const rawEdit = params.edit;
  const editParam = Array.isArray(rawEdit) ? rawEdit[0] : rawEdit;
  const requestedEdit = editParam === "1" || editParam === "true";
  const editMode = requestedEdit && isAdmin;

  return <NewsletterPageClient initialState={state} editMode={editMode} />;
}
