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
  /** Short product-specific cautions, shown on the guide itself. */
  safetyNotes: string[];
  /**
   * Links the guide to a shared set on /safety-guidelines, e.g. "incense". Left unset the guide
   * matches its product family automatically; "none" suppresses the block entirely.
   */
  safetySetId?: string;
  imageUrl?: string;
  videoUrl?: string;
  relatedProductIds: string[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

export type QrProductPageStore = { pages: Record<string, QrProductPage> };
