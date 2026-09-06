export type QrInstructionBlock = {
  id: string;
  heading: string;
  body: string;
};

export type QrProductPage = {
  id: string;
  slug: string;
  productId: string;
  productName: string;
  title: string;
  intro: string;
  instructions: QrInstructionBlock[];
  safetyNotes: string[];
  imageUrl?: string;
  videoUrl?: string;
  relatedProductIds: string[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

export type QrProductPageStore = { pages: Record<string, QrProductPage> };
