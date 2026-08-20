import { readJsonKv, writeJsonKv } from "./json-kv-store";
import type { HomepageContent } from "./homepage-content-types";
import { defaultHomepageContent } from "./homepage-content-types";

export type {
  HomepageContent,
  HomepagePlace,
  HomepageVideo,
  HomepageTestimonial,
} from "./homepage-content-types";
export { defaultHomepageContent } from "./homepage-content-types";

const KEY = "maroma:homepage-content";
const FILE = "homepage-content.json";

export async function readHomepageContent(): Promise<HomepageContent> {
  const stored = await readJsonKv<HomepageContent>(KEY, FILE, defaultHomepageContent());
  const defaults = defaultHomepageContent();
  return {
    aboutTitle: stored.aboutTitle?.trim() || defaults.aboutTitle,
    aboutBody: stored.aboutBody?.trim() || defaults.aboutBody,
    places: Array.isArray(stored.places) && stored.places.length ? stored.places : defaults.places,
    videos: Array.isArray(stored.videos) ? stored.videos : [],
    testimonials: Array.isArray(stored.testimonials) ? stored.testimonials : [],
    updatedAt: stored.updatedAt || defaults.updatedAt,
  };
}

export async function writeHomepageContent(content: HomepageContent): Promise<HomepageContent> {
  const next = { ...content, updatedAt: new Date().toISOString() };
  await writeJsonKv(KEY, FILE, next);
  return next;
}
