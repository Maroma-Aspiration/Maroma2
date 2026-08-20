import { readJsonKv, writeJsonKv } from "./json-kv-store";

export type B2bApplicationStatus = "pending" | "approved" | "declined";

export type B2bApplication = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  website: string;
  message: string;
  status: B2bApplicationStatus;
  createdAt: string;
  reviewedAt?: string;
};

type ApplicationStore = { applications: B2bApplication[] };

const KEY = "maroma:b2b-applications";
const FILE = "b2b-applications.json";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const empty = (): ApplicationStore => ({ applications: [] });

function parseApplication(raw: unknown): B2bApplication | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const companyName = typeof row.companyName === "string" ? row.companyName.trim() : "";
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
  if (!id || !companyName || !EMAIL_RE.test(email)) return null;
  const status: B2bApplicationStatus =
    row.status === "approved" || row.status === "declined" || row.status === "pending"
      ? row.status
      : "pending";
  return {
    id,
    companyName,
    contactName: typeof row.contactName === "string" ? row.contactName.trim() : "",
    email,
    phone: typeof row.phone === "string" ? row.phone.trim() : "",
    country: typeof row.country === "string" ? row.country.trim() : "",
    website: typeof row.website === "string" ? row.website.trim() : "",
    message: typeof row.message === "string" ? row.message.trim() : "",
    status,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    reviewedAt: typeof row.reviewedAt === "string" ? row.reviewedAt : undefined,
  };
}

export async function readB2bApplications(): Promise<ApplicationStore> {
  const stored = await readJsonKv<ApplicationStore>(KEY, FILE, empty());
  return {
    applications: (stored.applications ?? [])
      .map(parseApplication)
      .filter((a): a is B2bApplication => Boolean(a)),
  };
}

export async function submitB2bApplication(input: {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  website: string;
  message: string;
}): Promise<B2bApplication> {
  const email = input.email.trim().toLowerCase();
  const companyName = input.companyName.trim();
  if (!companyName) throw new Error("Company name is required.");
  if (!EMAIL_RE.test(email)) throw new Error("A valid email is required.");
  const store = await readB2bApplications();
  const existingPending = store.applications.find(
    (a) => a.email === email && a.status === "pending"
  );
  if (existingPending) {
    throw new Error("An application for this email is already awaiting review.");
  }
  const application: B2bApplication = {
    id: crypto.randomUUID(),
    companyName,
    contactName: input.contactName.trim().slice(0, 120),
    email,
    phone: input.phone.trim().slice(0, 40),
    country: input.country.trim().slice(0, 80),
    website: input.website.trim().slice(0, 200),
    message: input.message.trim().slice(0, 2000),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  store.applications = [application, ...store.applications].slice(0, 1000);
  await writeJsonKv(KEY, FILE, store);
  return application;
}

export async function setB2bApplicationStatus(
  id: string,
  status: B2bApplicationStatus
): Promise<B2bApplication | null> {
  const store = await readB2bApplications();
  const existing = store.applications.find((a) => a.id === id);
  if (!existing) return null;
  const updated: B2bApplication = {
    ...existing,
    status,
    reviewedAt: new Date().toISOString(),
  };
  store.applications = store.applications.map((a) => (a.id === id ? updated : a));
  await writeJsonKv(KEY, FILE, store);
  return updated;
}
