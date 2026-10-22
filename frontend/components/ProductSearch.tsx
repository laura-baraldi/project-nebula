import type { ProductFilters } from "@/lib/productFilters";

type ProductSearchProps = {
  filters: ProductFilters;
};

/**
 * Search products using a GET form.
 *
 * Preserve the selected category and sorting option.
 * Omit the page parameter so every new search starts on page 1.
 */
export default function ProductSearch({ filters }: ProductSearchProps) {
  return (
    <form
      action="/products"
      method="GET"
      role="search"
      className="flex flex-col gap-3 sm:flex-row"
    >
      {/* Preserve the existing filters when submitting a search. */}
      {filters.category && (
        <input type="hidden" name="category" value={filters.category} />
      )}

      {filters.sort !== "newest" && (
        <input type="hidden" name="sort" value={filters.sort} />
      )}

      <input
        type="search"
        name="q"
        aria-label="Search products"
        placeholder="Search products..."
        defaultValue={filters.q ?? ""}
        maxLength={100}
        className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-4 py-3 text-violet-900 placeholder:text-violet-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
      />

      <button
        type="submit"
        className="rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-800"
      >
        Search
      </button>
    </form>
  );
}
