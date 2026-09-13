import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../../lib/auth-session";
import { readLiveStorefrontCatalog } from "../../../../lib/product-catalog-admin";
import { readQrProductPageStore, writeQrProductPageStore } from "../../../../lib/qr-product-page-store";
import { generateQrInstructions } from "../../../../lib/qr-instruction-generator";
import { readSafetyGuidelines } from "../../../../lib/safety-guidelines-store";
import type { QrProductPage } from "../../../../lib/qr-product-page-types";

export const runtime = "nodejs";

async function requireAdmin(): Promise<boolean> {
  const secret = getSessionSecret();
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySessionPayload(token, secret) : null;
  return session?.role === "admin";
}

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);
const cleanLines = (value: unknown) => Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 12) : [];

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  const [{ products }, store, safety] = await Promise.all([readLiveStorefrontCatalog(), readQrProductPageStore(), readSafetyGuidelines()]);
  return NextResponse.json({
    pages: Object.values(store.pages).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    products,
    safetySets: safety.sets.map((set) => ({ id: set.id, label: set.label, languages: Object.keys(set.translations) })),
  });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; page?: Partial<QrProductPage>; productId?: string; id?: string };
    const { products } = await readLiveStorefrontCatalog();
    if (body.action === "generate") {
      const product = products.find((item) => item.id === body.productId);
      if (!product) return NextResponse.json({ error: "Choose a live catalog product first." }, { status: 400 });
      return NextResponse.json({ generated: generateQrInstructions(product), product });
    }
    const [store, safety] = await Promise.all([readQrProductPageStore(), readSafetyGuidelines()]);
    const safetySets = safety.sets;
    if (body.action === "delete") {
      const prior = body.id ? store.pages[body.id] : undefined;
      if (prior) { delete store.pages[prior.id]; await writeQrProductPageStore(store); revalidatePath(`/care/${prior.slug}`); }
      return NextResponse.json({ ok: true });
    }
    const patch = body.page ?? {};
    const product = products.find((item) => item.id === patch.productId);
    if (!product) return NextResponse.json({ error: "Choose a live catalog product." }, { status: 400 });
    const now = new Date().toISOString();
    const id = typeof patch.id === "string" && store.pages[patch.id] ? patch.id : `qr-${crypto.randomUUID()}`;
    const slug = slugify(String(patch.slug || product.name));
    if (!slug) return NextResponse.json({ error: "Add a valid page address." }, { status: 400 });
    const collision = Object.values(store.pages).find((item) => item.slug === slug && item.id !== id);
    if (collision) return NextResponse.json({ error: "That page address is already in use." }, { status: 409 });
    const prior = store.pages[id];
    const page: QrProductPage = {
      id, slug, productId: product.id, productName: product.name,
      title: String(patch.title || product.name).trim().slice(0, 140),
      intro: String(patch.intro || "").trim().slice(0, 600),
      instructions: Array.isArray(patch.instructions) ? patch.instructions.map((item, index) => ({ id: String(item.id || `step-${index + 1}`), heading: String(item.heading || "").trim().slice(0, 100), body: String(item.body || "").trim().slice(0, 1400) })).filter((item) => item.heading || item.body).slice(0, 10) : [],
      safetyNotes: cleanLines(patch.safetyNotes),
      safetySetId: patch.safetySetId === "none" || safetySets.some((set) => set.id === patch.safetySetId) ? patch.safetySetId : undefined,
      imageUrl: String(patch.imageUrl || "").trim() || undefined, videoUrl: String(patch.videoUrl || "").trim() || undefined,
      relatedProductIds: cleanLines(patch.relatedProductIds).filter((productId) => productId !== product.id && products.some((item) => item.id === productId)).slice(0, 8),
      status: patch.status === "published" ? "published" : "draft", createdAt: prior?.createdAt ?? now, updatedAt: now,
    };
    store.pages[id] = page; await writeQrProductPageStore(store);
    if (prior?.slug && prior.slug !== slug) revalidatePath(`/care/${prior.slug}`);
    revalidatePath(`/care/${slug}`); revalidatePath("/");
    return NextResponse.json({ ok: true, page });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save QR page." }, { status: 500 }); }
}
