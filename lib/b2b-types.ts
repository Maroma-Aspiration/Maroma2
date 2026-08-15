export type B2bCommerceMode = "quote" | "checkout";
export type B2bCompanyStatus = "pending" | "active" | "paused";

export type B2bAssortmentItem = {
  productId: string;
  /** Negotiated wholesale price in INR (number). */
  priceInr: number;
  /** Minimum order quantity for this SKU (default 1). */
  moq: number;
};

export type B2bCompany = {
  id: string;
  /** Bookmarkable path segment: /b2b/[slug] */
  slug: string;
  name: string;
  /** Single login for now — must match an existing auth user email. */
  userEmail: string;
  commerceMode: B2bCommerceMode;
  status: B2bCompanyStatus;
  notes?: string;
  assortment: B2bAssortmentItem[];
  createdAt: string;
  updatedAt: string;
};

export type B2bQuoteLine = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPriceInr: number;
  lineTotalInr: number;
};

export type B2bQuoteRequest = {
  id: string;
  companyId: string;
  companySlug: string;
  companyName: string;
  userEmail: string;
  lines: B2bQuoteLine[];
  message: string;
  subtotalInr: number;
  createdAt: string;
  status: "received" | "reviewed" | "closed";
};

export type B2bStore = {
  companies: B2bCompany[];
  quotes: B2bQuoteRequest[];
};
