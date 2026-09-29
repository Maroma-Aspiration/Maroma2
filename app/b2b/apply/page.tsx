import B2bApplyClient from "./b2b-apply-client";
import { buildPageMetadata } from "../../../lib/site-seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "B2B application | Maroma",
  description: "Apply to become a Maroma retail, distribution, gifting or white-label partner.",
  path: "/b2b/apply",
  noIndex: true,
});

export default function B2bApplyPage() {
  return <B2bApplyClient />;
}
