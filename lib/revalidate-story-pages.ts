import { revalidatePath } from "next/cache";

/** Invalidate cached blog + newsletter after stories change (KV/file write). */
export function revalidateStoryConsumerRoutes(): void {
  revalidatePath("/blog", "layout");
  revalidatePath("/newsletter");
}
