import Link from "next/link";

import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
  type ProductFilters,
} from "@/lib/productFilters";

// Display labels for the categories supported by the Express API.
const CATEGORY_LABELS: Record<ProductCategory, string> = {
  clothing: "Clothing",
  home: "Home",
  skincare: "Skincare",
  tech: "Technology",
  toys: "Toys",
  food: "Food",
  accessories: "Accessories",
  travel: "Travel",
};

type CategoryFiltersProps = {
  filters: ProductFilters;
};

/**
 * Build a catalog URL for the selected category.
 *
 * Preserve the current search and sorting options, but reset
 * pagination to page 1 whenever the category changes.
 */
function categoryUrl(
  filters: ProductFilters,
  category?: ProductCategory,
): string {
  const params = new URLSearchParams();

  if (category) {
    params.set("category", category);
  }

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.sort !== "newest") {
    params.set("sort", filters.sort);
  }

  const query = params.toString();

  if (query) {
    return `/products?${query}`;
  }

  return "/products";
}

type CategoryListProps = {
  filters: ProductFilters;
};

/**
 * Reusable category links for both desktop and mobile layouts.
 *
 * The active category is marked with aria-current and highlighted.
 */
function CategoryList({ filters }: CategoryListProps) {
  const baseClasses =
    "block rounded-lg px-3 py-2 text-sm font-medium transition-colors";

  const activeClasses = "bg-violet-700 text-white";

  const inactiveClasses = "text-violet-800 hover:bg-violet-100";

  return (
    <nav aria-label="Product categories">
      <ul className="space-y-1">
        <li>
          <Link
            href={categoryUrl(filters)}
            aria-current={!filters.category ? "page" : undefined}
            className={`${baseClasses} ${
              !filters.category ? activeClasses : inactiveClasses
            }`}
          >
            All Products
          </Link>
        </li>

        {PRODUCT_CATEGORIES.map((category) => {
          const isActive = filters.category === category;

          return (
            <li key={category}>
              <Link
                href={categoryUrl(filters, category)}
                aria-current={isActive ? "page" : undefined}
                className={`${baseClasses} ${
                  isActive ? activeClasses : inactiveClasses
                }`}
              >
                {CATEGORY_LABELS[category]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Display categories in a desktop sidebar and a collapsible
 * mobile menu without requiring client-side React state.
 */
export default function CategoryFilters({ filters }: CategoryFiltersProps) {
  return (
    <>
      {/* Mobile: collapsible category menu. */}
      <details className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm lg:hidden">
        <summary className="cursor-pointer font-semibold text-violet-900">
          Filters
        </summary>

        <div className="mt-4 border-t border-violet-100 pt-4">
          <h2 className="mb-3 text-sm font-semibold text-violet-900">
            Categories
          </h2>

          <CategoryList filters={filters} />
        </div>
      </details>

      {/* Desktop: persistent category sidebar. */}
      <aside className="hidden self-start rounded-2xl border border-violet-200 bg-white p-5 shadow-sm lg:block">
        <h2 className="mb-4 text-lg font-bold text-violet-900">Categories</h2>

        <CategoryList filters={filters} />
      </aside>
    </>
  );
}
