export type ReviewFeedbackType = "bug" | "change" | "question" | "praise";

export type ReviewFeedbackItem = {
  id: string;
  page: string;
  pageTitle: string;
  area: string;
  areaId?: string;
  suggestedFiles: string[];
  feedback: string;
  type: ReviewFeedbackType;
  createdAt: string;
};

const STORAGE_KEY = "maroma2-review-feedback";

export function isReviewModeEnabled() {
  return false;
}

export function loadReviewFeedback(): ReviewFeedbackItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReviewFeedbackItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReviewFeedback(items: ReviewFeedbackItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function clearReviewFeedback() {
  localStorage.removeItem(STORAGE_KEY);
}

function formatReviewTimestamp(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function compileReviewReport(items: ReviewFeedbackItem[]) {
  const pages = [...new Set(items.map((item) => item.page))];
  const timestamp = new Date().toISOString();
  const counts = items.reduce<Record<ReviewFeedbackType, number>>(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    { bug: 0, change: 0, question: 0, praise: 0 }
  );

  const summaryLines = [
    `- ${items.length} note${items.length === 1 ? "" : "s"} across ${pages.length || 0} page${pages.length === 1 ? "" : "s"}`,
  ];
  if (counts.bug) summaryLines.push(`- ${counts.bug} bug${counts.bug === 1 ? "" : "s"} / broken`);
  if (counts.change) summaryLines.push(`- ${counts.change} change request${counts.change === 1 ? "" : "s"}`);
  if (counts.question) summaryLines.push(`- ${counts.question} question${counts.question === 1 ? "" : "s"}`);
  if (counts.praise) summaryLines.push(`- ${counts.praise} positive note${counts.praise === 1 ? "" : "s"}`);

  const header = `Site review report
Generated ${formatReviewTimestamp(timestamp)}

Summary
${summaryLines.join("\n")}`;

  if (items.length === 0) {
    return `${header}\n\nNo feedback collected yet. Browse the site in review mode and add notes using the feedback buttons.`;
  }

  const grouped = new Map<string, ReviewFeedbackItem[]>();
  for (const item of items) {
    const bucket = grouped.get(item.page);
    if (bucket) bucket.push(item);
    else grouped.set(item.page, [item]);
  }

  const body = [...grouped.entries()]
    .map(([page, pageItems]) => {
      const pageLabel = pageItems[0]?.pageTitle ?? page;
      const notes = pageItems
        .map((item, index) => {
          const captured = formatReviewTimestamp(item.createdAt);
          return `${index + 1}. ${item.area} (${REVIEW_TYPE_LABELS[item.type]})
   ${item.feedback.trim()}
   Captured ${captured}`;
        })
        .join("\n\n");

      return `${pageLabel}
Page: ${page}

${notes}`;
    })
    .join("\n\n---\n\n");

  return `${header}\n\n---\n\n${body}`;
}

export function compileReviewPrompt(items: ReviewFeedbackItem[]) {
  const pages = [...new Set(items.map((item) => item.page))];
  const timestamp = new Date().toISOString();

  const header = `# Maroma2 site review feedback

Use this prompt in Cursor to implement the requested changes.

## Review context
- App: Maroma shopping site (Next.js App Router, maromashopping.com)
- Review captured: ${timestamp}
- Pages with feedback: ${pages.join(", ") || "none"}
- Total items: ${items.length}

## Instructions for the agent
1. Read each item below and implement the requested change.
2. Use the suggested files as a starting point; search the codebase if needed.
3. Keep changes minimal and match existing patterns.
4. Deploy to production when done (npm run deploy:prod).
5. Mark items as addressed in your summary.

---

`;

  if (items.length === 0) {
    return `${header}No feedback items collected yet. Browse the site in review mode and add notes using the feedback markers.`;
  }

  const body = items
    .map((item, index) => {
      const files =
        item.suggestedFiles.length > 0
          ? item.suggestedFiles.map((file) => `- \`${file}\``).join("\n")
          : "- (infer from page and area name)";

      return `## ${index + 1}. ${item.pageTitle} > ${item.area}

**Type:** ${item.type}
**Page path:** \`${item.page}\`${item.areaId ? `\n**Area id:** \`${item.areaId}\`` : ""}
**Captured:** ${item.createdAt}

**Suggested files:**
${files}

**Feedback:**
${item.feedback.trim()}
`;
    })
    .join("\n---\n\n");

  return `${header}${body}`;
}

export const REVIEW_TYPE_LABELS: Record<ReviewFeedbackType, string> = {
  bug: "Bug / broken",
  change: "Change request",
  question: "Question / clarify",
  praise: "Works well",
};
