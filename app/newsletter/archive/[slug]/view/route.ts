import { unstable_noStore as noStore } from "next/cache";
import { getArchiveIssueBySlug } from "../../../../../lib/newsletter-archive-storage";
import { renderArchiveIssueEmailHtml } from "../../../../../lib/newsletter-archive-render";
import { SITE_URL } from "../../../../../lib/newsletter-archive-seo";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/** Raw HTML for a specific archived issue — matches the sent email. */
export async function GET(_request: Request, context: RouteContext) {
  noStore();
  const { slug } = await context.params;
  const issue = await getArchiveIssueBySlug(slug);
  if (!issue) {
    return new Response("<p>Newsletter issue not found.</p>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const html = renderArchiveIssueEmailHtml(issue, SITE_URL);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
