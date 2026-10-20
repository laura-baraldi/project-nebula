/**
 * Supported catalog categories and sorting options.
 *
 * These values must match the existing Express products API.
 */
export const PRODUCT_CATEGORIES = [
  "clothing",
  "home",
  "skincare",
  "tech",
  "toys",
  "food",
  "accessories",
  "travel",
] as const;

export const PRODUCT_SORT_OPTIONS = [
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number];

export type ProductFilters = {
  category?: ProductCategory;
  q?: string;
  sort: ProductSort;
  page: number;
};

type SearchParameters = Record<string, string | string[] | undefined>;

const DEFAULT_SORT: ProductSort = "newest";
const DEFAULT_PAGE = 1;
export const PRODUCTS_PER_PAGE = 20;

/**
 * Convert untrusted URL query parameters into valid catalog filters.
 *
 * Invalid categories and sorting options fall back to defaults.
 * Invalid page numbers are normalized to page 1.
 * Search text is trimmed and limited to 100 characters.
 */
export function parseProductFilters(params: SearchParameters): ProductFilters {
  const category = params.category;
  const sort = params.sort;
  const search = params.q;
  const rawPage = params.page;

  const validCategory =
    typeof category === "string" &&
    PRODUCT_CATEGORIES.some((value) => value === category)
      ? (category as ProductCategory)
      : undefined;

  const validSort =
    typeof sort === "string" &&
    PRODUCT_SORT_OPTIONS.some((value) => value === sort)
      ? (sort as ProductSort)
      : DEFAULT_SORT;

  const validSearch =
    typeof search === "string" ? search.trim().slice(0, 100) : "";

  const validPage =
    typeof rawPage === "string" &&
    /^[1-9]\d*$/.test(rawPage) &&
    Number.isSafeInteger(Number(rawPage))
      ? Number(rawPage)
      : DEFAULT_PAGE;

  return {
    ...(validCategory ? { category: validCategory } : {}),
    ...(validSearch ? { q: validSearch } : {}),
    sort: validSort,
    page: validPage,
  };
}

/**
 * Build the backend query string from validated catalog filters.
 *
 * URLSearchParams handles the encoding of user-provided search text.
 */
export function buildProductQuery(filters: ProductFilters): string {
  const params = new URLSearchParams();

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.q) {
    params.set("q", filters.q);
  }

  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  params.set("limit", String(PRODUCTS_PER_PAGE));

  return params.toString();
}
