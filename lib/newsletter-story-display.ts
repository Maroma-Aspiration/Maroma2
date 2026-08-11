/** Strip HTML to a single normalized plain string (for duplicate checks only). */
function stripTagsToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse typography variants so excerpt vs body compare reliably after imports. */
function normalizePlain(s: string): string {
  const t = /[<>]/.test(s) ? stripTagsToPlain(s) : s.replace(/\s+/g, " ").trim();
  return t
    .normalize("NFC")
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function firstParagraphInnerHtml(html: string): string | null {
  const m = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return m ? m[1] : null;
}

function isDuplicateLead(excerptNorm: string, bodyPlainNorm: string): boolean {
  if (!excerptNorm || excerptNorm.length < 12) return false;
  if (!bodyPlainNorm) return false;
  if (bodyPlainNorm === excerptNorm) return true;
  if (bodyPlainNorm.startsWith(excerptNorm)) return true;
  if (excerptNorm.startsWith(bodyPlainNorm)) return true;
  return false;
}

/**
 * Newsletter shell uses centered text for excerpts; the story body is left-aligned.
 * When imports copy the same lead into both excerpt and HTML body, hide the excerpt
 * so readers do not see duplicate blocks.
 */
export function hideNewsletterExcerptBecauseBodyCoversIt(excerpt: string, bodyHtml: string): boolean {
  const html = bodyHtml.trim();
  if (!html) return false;
  const exRaw = excerpt.replace(/\s+/g, " ").trim();
  if (!exRaw) return true;

  const exN = normalizePlain(exRaw);
  const fullPlain = stripTagsToPlain(html);
  const fullN = normalizePlain(fullPlain.length ? fullPlain : html);

  if (isDuplicateLead(exN, fullN)) return true;

  const firstInner = firstParagraphInnerHtml(html);
  if (firstInner) {
    const firstN = normalizePlain(firstInner);
    if (isDuplicateLead(exN, firstN)) return true;
  }

  return false;
}
