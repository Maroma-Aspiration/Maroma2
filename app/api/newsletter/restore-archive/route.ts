import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { canEditNewsletter } from "../../../../lib/auth-roles";
import { listArchiveSummaries } from "../../../../lib/newsletter-archive-storage";
import { listTestSnapshotSummaries } from "../../../../lib/newsletter-test-snapshot-storage";
import { restoreArchiveIssueToLive } from "../../../../lib/newsletter-restore-archive";
import { revalidateStoryConsumerRoutes } from "../../../../lib/revalidate-story-pages";

export const dynamic = "force-dynamic";

async function requireNewsletterEditor() {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || !canEditNewsletter(session.role)) {
    return null;
  }
  return session;
}

export async function GET() {
  if (!(await requireNewsletterEditor())) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  const [issues, tests] = await Promise.all([listArchiveSummaries(), listTestSnapshotSummaries()]);
  return NextResponse.json({ issues: [...tests, ...issues] });
}

export async function POST(request: Request) {
  if (!(await requireNewsletterEditor())) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { slug?: string; month?: string };
    const result = await restoreArchiveIssueToLive(body.slug, body.month);
    revalidateStoryConsumerRoutes();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not restore that issue." },
      { status: 400 }
    );
  }
}
