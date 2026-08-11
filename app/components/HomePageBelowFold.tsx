"use client";

import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProductListingWithFilters } from "./ProductListingWithFilters";
import { InstagramSection } from "./InstagramSection";
import { catalogCategories } from "../../lib/catalog-categories";
import type { ProductRecord } from "../../lib/product-types";

type HomePageBelowFoldProps = {
  brand: string;
  products: ProductRecord[];
  productSearch: string;
  productStatus: string;
  onProductSearchChange: (value: string) => void;
};

/** Below-fold homepage content — isolated from hero layout churn. */
export const HomePageBelowFold = memo(function HomePageBelowFold({
  brand,
  products,
  productSearch,
  productStatus,
  onProductSearchChange,
}: HomePageBelowFoldProps) {
  const router = useRouter();

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onProductSearchChange(event.target.value);
    },
    [onProductSearchChange]
  );

  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const slug = event.target.value;
      if (slug) {
        router.push(`/${slug}`);
      }
    },
    [router]
  );

  return (
    <>
      <InstagramSection />

      <div className="ticker-top-banner">
        <img src="/staging-media/banners/care-banner.png" alt="" aria-hidden="true" />
      </div>

      <section className="scrolling-ticker-section">
        <div className="ticker-wrap">
          <div className="ticker">
            <span className="ticker__item">
              Vegan and Cruelty-free • No rabbits (or any other living thing was harmed or in any way even slightly inconvenienced by the creation of our products) • World Fair Trade Certified - everyone gets paid a fair wage and treated with respect • Naturally derived • Almost entirely locally-sourced • Palm-Oil Free • Good For You • Good for the Planet •
            </span>
            <span className="ticker__item">
              Vegan and Cruelty-free • No rabbits (or any other living thing was harmed or in any way even slightly inconvenienced by the creation of our products) • World Fair Trade Certified - everyone gets paid a fair wage and treated with respect • Naturally derived • Almost entirely locally-sourced • Palm-Oil Free • Good For You • Good for the Planet •
            </span>
          </div>
        </div>
      </section>

      <section className="product-database" id="shop" style={{ scrollMarginTop: "100px" }} aria-label="Searchable product database">
        <div className="product-database-head">
          <div>
            <span className="eyebrow scroll-zoom">Shop database</span>
            <h2 className="scroll-zoom">Find Your Product Here</h2>
          </div>
          <label className="product-search">
            <span>Search products</span>
            <select
              className="product-search-category"
              defaultValue=""
              aria-label="Browse by category"
              onChange={handleCategoryChange}
            >
              <option value="">All categories</option>
              {catalogCategories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={productSearch}
              onChange={handleSearchChange}
              placeholder="Try soap, lavender, shampoo..."
            />
          </label>
        </div>
        <p className="product-status">{productStatus}</p>
        <div className="product-listing-section">
          <ProductListingWithFilters products={products} />
        </div>
      </section>

      <footer className="footer">
        <strong>{brand}</strong>
        <div>Preview only. Replace placeholders with real media.</div>
      </footer>
    </>
  );
});
