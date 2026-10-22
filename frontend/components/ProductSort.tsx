import type { ProductFilters } from "@/lib/productFilters";

type ProductSortProps = {
  filters: ProductFilters;
};

export default function ProductSort({ filters }: ProductSortProps) {
  return (
    <form
      action="/products"
      method="GET"
      aria-label="Sort products"
      className="flex flex-wrap items-center gap-3"
    >
      {/* Preserve the active category and search query. */}
      {filters.category && (
        <input type="hidden" name="category" value={filters.category} />
      )}

      {filters.q && <input type="hidden" name="q" value={filters.q} />}

      <label
        htmlFor="product-sort"
        className="text-sm font-medium text-violet-900"
      >
        Sort by
      </label>

      <select
        id="product-sort"
        name="sort"
        defaultValue={filters.sort}
        className="rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm text-violet-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
      >
        <option value="newest">Newest First</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="name_asc">Name: A to Z</option>
      </select>

      <button
        type="submit"
        className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
      >
        Apply
      </button>
    </form>
  );
}
