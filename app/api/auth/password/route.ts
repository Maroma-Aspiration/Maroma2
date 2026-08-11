import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { changeAuthUserPassword } from "../../../../lib/auth-user-store";

export async function PATCH(request: Request) {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!secret || !token) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const session = await verifySessionPayload(token, secret);
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let currentPassword = "";
  let newPassword = "";
  try {
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new passwords are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  try {
    await changeAuthUserPassword(session.email, currentPassword, newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "invalid_current") {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }
    return NextResponse.json({ error: "Could not update password." }, { status: 500 });
  }
}
