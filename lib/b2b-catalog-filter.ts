export type B2bCatalogRow = {
  productId: string;
  sku: string;
  name: string;
  imageUrl: string;
  priceInr: number;
  moq: number;
  retailPriceInr: number | null;
  primaryCategory: string;
  categories: string[];
  brand: string;
};

export type B2bCatalogSort =
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"
  | "sku_asc";

export type B2bCatalogQuickFilter = "all" | "in_order" | "moq";

export type B2bCatalogFilters = {
  query: string;
  category: string;
  brand: string;
  sort: B2bCatalogSort;
  quick: B2bCatalogQuickFilter;
};

export function filterB2bCatalog(
  rows: B2bCatalogRow[],
  filters: B2bCatalogFilters,
  qtyByProductId: Record<string, number>
): B2bCatalogRow[] {
  const query = filters.query.trim().toLowerCase();
  let next = rows;

  if (query) {
    next = next.filter((row) =>
      `${row.name} ${row.sku} ${row.primaryCategory} ${row.brand} ${row.categories.join(" ")}`
        .toLowerCase()
        .includes(query)
    );
  }

  if (filters.category) {
    next = next.filter(
      (row) =>
        row.primaryCategory === filters.category || row.categories.includes(filters.category)
    );
  }

  if (filters.brand) {
    next = next.filter((row) => row.brand === filters.brand);
  }

  if (filters.quick === "in_order") {
    next = next.filter((row) => Math.max(0, Math.floor(qtyByProductId[row.productId] || 0)) >= 1);
  } else if (filters.quick === "moq") {
    next = next.filter((row) => row.moq > 1);
  }

  const sorted = [...next];
  sorted.sort((a, b) => {
    switch (filters.sort) {
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "price_asc":
        return a.priceInr - b.priceInr;
      case "price_desc":
        return b.priceInr - a.priceInr;
      case "sku_asc":
        return a.sku.localeCompare(b.sku);
      case "name_asc":
      default:
        return a.name.localeCompare(b.name);
    }
  });

  return sorted;
}

export function listB2bCatalogCategories(rows: B2bCatalogRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const category of row.categories) {
      if (category.trim()) set.add(category.trim());
    }
    if (row.primaryCategory.trim()) set.add(row.primaryCategory.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function listB2bCatalogBrands(rows: B2bCatalogRow[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.brand.trim()) set.add(row.brand.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
