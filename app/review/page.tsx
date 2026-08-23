import { ReviewExportPanel } from "../components/review-feedback/review-export-panel";

export const metadata = {
  title: "Review export | Maroma",
  description: "Export collected site review feedback as a Cursor-ready prompt.",
};

export default function ReviewPage() {
  return <ReviewExportPanel />;
}
