import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import {
  readHomepageContent,
  writeHomepageContent,
  type HomepageContent,
} from "../../../lib/homepage-content-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const content = await readHomepageContent();
  return NextResponse.json({ content });
}

export async function POST(request: Request) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { content?: HomepageContent };
  if (!body.content) return NextResponse.json({ error: "content required." }, { status: 400 });
  const content = await writeHomepageContent(body.content);
  return NextResponse.json({ content });
}
