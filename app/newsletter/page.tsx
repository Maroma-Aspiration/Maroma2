import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../lib/auth-session";
import { canEditNewsletter } from "../../lib/auth-roles";
import { restoreJulyIssueIfAvailable } from "../../lib/newsletter-restore-archive";
import { readStoriesState } from "../../lib/story-storage";
import { buildOgImageFromCanvas } from "../../lib/newsletter-archive-seo";
import type { NewsletterBlock, StoriesState, StoryRecord } from "../../lib/story-types";
import NewsletterPageClient from "./newsletter-page-client";

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://maroma.com").replace(/\/$/, "");
const NEWSLETTER_URL = `${SITE_URL}/newsletter`;

function safeMetadataBase(url: string): URL {
  try {
    return new URL(url);
  } catch {
    return new URL("https://maroma.com");
  }
}

function buildIssueTitle(state: StoriesState): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
  const base = state.newsletterTitle?.trim() || "Newsletter";
  return `${base} | ${month}`;
}

function buildDescription(state: StoriesState): string {
  const candidates: string[] = [];
  if (state.newsletterMission?.trim()) candidates.push(state.newsletterMission.trim());
  if (state.newsletterIntro?.trim()) candidates.push(state.newsletterIntro.trim());
  for (const block of state.newsletterBlocks ?? []) {
    if ((block.kind === "text" || block.kind === "text-box") && block.html) {
      candidates.push(block.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    }
  }
  for (const story of state.stories ?? []) {
    if (story.excerpt?.trim()) candidates.push(story.excerpt.trim());
    else if (story.body?.trim()) candidates.push(story.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }
  const summary = candidates.find((c) => c.length > 40) ?? candidates[0] ?? "";
  return summary.length > 220 ? `${summary.slice(0, 217)}…` : summary || "Latest stories from Maroma: natural fragrance, ritual & community from Auroville.";
}

function buildOgImage(state: StoriesState): string | undefined {
  const fromCanvas = buildOgImageFromCanvas(state.newsletterCanvas);
  if (fromCanvas) return fromCanvas;
  const block = (state.newsletterBlocks ?? []).find((b): b is Extract<NewsletterBlock, { kind: "image" }> => b.kind === "image" && b.images.length > 0);
  if (block) return block.images[0];
  if (state.newsletterHeroImageUrl?.trim()) return state.newsletterHeroImageUrl.trim();
  if (state.newsletterPortraitUrl?.trim()) return state.newsletterPortraitUrl.trim();
  if (state.newsletterTopImageUrl?.trim()) return state.newsletterTopImageUrl.trim();
  const story = (state.stories ?? []).find((s) => s.imageUrl?.trim() || (s.images && s.images.length > 0));
  if (story) return (story.imageUrl || story.images?.[0]) ?? undefined;
  return undefined;
}

async function loadNewsletterState(): Promise<StoriesState> {
  return (await restoreJulyIssueIfAvailable()) ?? (await readStoriesState());
}

export async function generateMetadata(): Promise<Metadata> {
  noStore();
  const state = await loadNewsletterState();
  const title = buildIssueTitle(state);
  const description = buildDescription(state);
  const ogImage = buildOgImage(state);
  const images = ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: title }] : undefined;

  return {
    title,
    description,
    metadataBase: safeMetadataBase(SITE_URL),
    alternates: { canonical: NEWSLETTER_URL },
    openGraph: {
      type: "article",
      url: NEWSLETTER_URL,
      siteName: "Maroma",
      title,
      description,
      images,
      locale: "en_US"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images?.map((i) => i.url)
    },
    robots: { index: true, follow: true }
  };
}

function buildJsonLd(state: StoriesState) {
  const title = buildIssueTitle(state);
  const description = buildDescription(state);
  const image = buildOgImage(state);
  const datePublished = new Date().toISOString();

  const featured = (state.stories ?? [])
    .filter((s: StoryRecord) => s.kind !== "divider" && s.kind !== "text")
    .slice(0, 12)
    .map((story, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: story.ctaUrl || story.sourceUrl || `${NEWSLETTER_URL}#story-${story.slug || story.id}`,
      name: story.title || "Untitled",
      image: story.imageUrl || story.images?.[0]
    }));

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description,
    datePublished,
    dateModified: datePublished,
    image: image ? [image] : undefined,
    inLanguage: "en",
    mainEntityOfPage: { "@type": "WebPage", "@id": NEWSLETTER_URL },
    publisher: {
      "@type": "Organization",
      name: "Maroma",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/maroma-logo.png` }
    },
    author: { "@type": "Organization", name: "Maroma" },
    hasPart:
      featured.length > 0
        ? {
            "@type": "ItemList",
            itemListElement: featured
          }
        : undefined
  };
}

export default async function NewsletterPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  const canEdit = canEditNewsletter(session?.role);
  const params = (await searchParams) ?? {};
  const rawEdit = params.edit;
  const editParam = Array.isArray(rawEdit) ? rawEdit[0] : rawEdit;
  const requestedEdit = editParam === "1" || editParam === "true";

  if (!canEdit) {
    if (requestedEdit) {
      redirect("/login?next=/newsletter%3Fedit%3D1");
    }
    redirect("/blog");
  }

  const state = await loadNewsletterState();

  return (
    <NewsletterPageClient
      initialState={state}
      editMode
      isAdmin={session?.role === "admin"}
      canEditNewsletter={canEdit}
    />
  );
}
