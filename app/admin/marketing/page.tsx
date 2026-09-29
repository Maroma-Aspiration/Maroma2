import { ChapterNav } from "./chapter-nav";
import { Lookbook } from "./lookbook";
import { LookbookHeader } from "./lookbook-header";
import { MarketingPageChrome } from "./page-chrome";

export const dynamic = "force-dynamic";

export default function AdminMarketingPage() {
  return (
    <>
      <MarketingPageChrome />
      <a href="#meet" className="ml-skip">
        Skip to lookbook
      </a>
      <LookbookHeader />
      <ChapterNav />
      <Lookbook />
    </>
  );
}
