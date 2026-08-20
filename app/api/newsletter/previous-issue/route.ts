import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { canEditNewsletter } from "../../../../lib/auth-roles";
import {
  clearPreviousNewsletterIssueServer,
  readPreviousNewsletterIssue,
  writePreviousNewsletterIssue,
} from "../../../../lib/newsletter-previous-issue-storage";
import { revalidateStoryConsumerRoutes } from "../../../../lib/revalidate-story-pages";
import type { StoriesState } from "../../../../lib/story-types";

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
  const previous = await readPreviousNewsletterIssue();
  if (!previous) {
    return NextResponse.json({ exists: false, state: null });
  }
  return NextResponse.json({
    exists: true,
    savedAt: previous.savedAt,
    state: previous.state,
  });
}

export async function PUT(request: Request) {
  if (!(await requireNewsletterEditor())) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { state?: StoriesState };
    if (!body.state || typeof body.state !== "object") {
      return NextResponse.json({ error: "Missing newsletter state to back up." }, { status: 400 });
    }
    const record = await writePreviousNewsletterIssue(body.state);
    return NextResponse.json({ exists: true, savedAt: record.savedAt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the previous issue." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (!(await requireNewsletterEditor())) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  await clearPreviousNewsletterIssueServer();
  revalidateStoryConsumerRoutes();
  return NextResponse.json({ exists: false });
}
