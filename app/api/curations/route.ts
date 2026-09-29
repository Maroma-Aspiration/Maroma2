import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import { saveCurationProfile } from "../../../lib/curations-store";

export async function POST(request: Request) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  if (!session) return NextResponse.json({ error: "Please sign in to save Curations." }, { status: 401 });

  try {
    const body = (await request.json()) as {
      category?: string;
      name?: string;
      productIds?: string[];
      choices?: { type?: string; goal?: string; routine?: string };
    };
    const profile = await saveCurationProfile({
      email: session.email,
      name: body.name ?? "",
      category: body.category ?? "face-care",
      productIds: Array.isArray(body.productIds) ? body.productIds : [],
      choices: {
        type: body.choices?.type ?? "",
        goal: body.choices?.goal ?? "",
        routine: body.choices?.routine ?? ""
      }
    });
    return NextResponse.json({ ok: true, profile: { ...profile, email: undefined } });
  } catch {
    return NextResponse.json({ error: "Unable to save Curations." }, { status: 400 });
  }
}
