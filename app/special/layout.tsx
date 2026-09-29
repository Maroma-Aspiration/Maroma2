import { buildPageMetadata } from "../../lib/site-seo";

export const metadata = buildPageMetadata({
  title: "Find your Maroma ritual",
  description: "Answer a few simple questions to discover Maroma products chosen for your ritual.",
  path: "/special",
});

export default function SpecialLayout({ children }: { children: React.ReactNode }) {
  return children;
}
