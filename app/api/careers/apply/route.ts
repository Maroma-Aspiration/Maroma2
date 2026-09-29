import { NextResponse } from "next/server";
import { submitCareersApplication } from "../../../../lib/careers-applications-store";
import { resolveFromEmail, sendEmail } from "../../../../lib/newsletter-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INBOX = "maroma@maroma.com";
const AREAS = new Set([
  "Production and packing",
  "Fragrance and product development",
  "Design and storytelling",
  "Retail and hospitality",
  "Digital and commerce",
  "Other",
]);

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  if (!value) return "";
  return `<p style="margin:0 0 10px"><strong>${escapeHtml(label)}</strong><br/>${escapeHtml(value).replace(/\n/g, "<br/>")}</p>`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (text(body.company, 80)) {
    return NextResponse.json({ ok: true });
  }

  const name = text(body.name, 120);
  const email = text(body.email, 180);
  const phone = text(body.phone, 60);
  const area = text(body.area, 80);
  const startDate = text(body.startDate, 40);
  const duration = text(body.duration, 80);
  const note = text(body.note, 4000);
  const needs = text(body.needs, 2000);
  const cvLink = text(body.cvLink, 400);

  if (!name || !email || !note || !area) {
    return NextResponse.json(
      { error: "Please add your name, email, area, and a short note." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!AREAS.has(area)) {
    return NextResponse.json({ error: "Please choose an area from the list." }, { status: 400 });
  }
  if (cvLink && !/^https?:\/\//i.test(cvLink)) {
    return NextResponse.json({ error: "CV link must start with http:// or https://." }, { status: 400 });
  }

  let application;
  try {
    application = await submitCareersApplication({
      name,
      email,
      phone,
      area,
      startDate,
      duration,
      note,
      needs,
      cvLink,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not save your application. Please email maroma@maroma.com." },
      { status: 502 }
    );
  }

  const from = resolveFromEmail();
  if (from) {
    await sendEmail({
      from,
      to: INBOX,
      subject: `Internship application: ${name}`,
      html: `<div style="font-family:Georgia,serif;line-height:1.5;color:#134a57">
        <p style="margin:0 0 16px">New internship application from the Maroma careers page.</p>
        ${row("Name", name)}
        ${row("Email", email)}
        ${row("Phone", phone)}
        ${row("Area", area)}
        ${row("Available from", startDate)}
        ${row("Duration", duration)}
        ${row("Note", note)}
        ${row("Visa or housing", needs)}
        ${row("CV", cvLink)}
      </div>`,
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, id: application.id });
}
