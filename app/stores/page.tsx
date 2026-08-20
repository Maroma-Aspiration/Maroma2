import { readStoreLocator } from "../../lib/store-locator-store";
import { buildPageMetadata } from "../../lib/site-seo";
import StoreLocatorClient from "./store-locator-client";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Store locator | Maroma",
  description: "Find Maroma stores, retailers, distributors, the Auroville outlet, café and spa.",
  path: "/stores",
});

export default async function StoreLocatorPage() {
  const store = await readStoreLocator();
  return <StoreLocatorClient locations={store.locations} />;
}
