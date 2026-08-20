import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy hub — site editing lives on the homepage floating admin. */
export default function AdminPage() {
  redirect("/?skipIntro=1");
}
