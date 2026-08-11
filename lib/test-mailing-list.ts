const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const TEST_MAILING_LIST_LS_KEY = "maroma-test-mailing-list";

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function formatEmailList(emails: string[]): string {
  return emails.join(", ");
}

export function loadTestMailingList(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEST_MAILING_LIST_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parseEmailList(parsed.filter((e): e is string => typeof e === "string").join(", "));
  } catch {
    return [];
  }
}

export function saveTestMailingList(emails: string[]): void {
  const normalized = parseEmailList(emails.join(", "));
  try {
    localStorage.setItem(TEST_MAILING_LIST_LS_KEY, JSON.stringify(normalized));
  } catch {
    /* quota */
  }
}
