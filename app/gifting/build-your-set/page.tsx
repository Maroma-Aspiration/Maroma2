import GiftBuilderClient from "./gift-builder-client";

export const metadata = {
  title: "Build Your Gift Set · Maroma",
  description:
    "Create your own Maroma gift set: choose a box, select elements, and see your curated collection come together.",
};

export default function BuildYourGiftSetPage() {
  return <GiftBuilderClient />;
}
