import { buildPageMetadata } from "../../lib/site-seo";

export const metadata = buildPageMetadata({
  title: "Maroma rituals | Morning, evening and home",
  description: "Explore botanical morning, evening and home rituals from Maroma in Auroville.",
  path: "/rituals",
});

export default function RitualsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
