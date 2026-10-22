import Link from "next/link";

import type { ProductFilters } from "@/lib/productFilters";

type ProductPaginationProps = {
  filters: ProductFilters;
  page: number;
  totalPages: number;
};

function pageUrl(filters: ProductFilters, page: number): string {
  const params = new URLSearchParams();

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.sort !== "newest") {
    params.set("sort", filters.sort);
  }

  params.set("page", String(page));

  return `/products?${params.toString()}`;
}

export default function ProductPagination({
  filters,
  page,
  totalPages,
}: ProductPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  const buttonClasses =
    "rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-900 transition-colors hover:bg-violet-100";

  const disabledClasses =
    "cursor-not-allowed rounded-xl border border-violet-100 bg-violet-50 px-4 py-2 text-sm text-violet-300";

  return (
    <nav
      aria-label="Product pagination"
      className="mt-10 flex flex-wrap items-center justify-center gap-4"
    >
      {hasPrevious ? (
        <Link href={pageUrl(filters, page - 1)} className={buttonClasses}>
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClasses}>
          Previous
        </span>
      )}

      <span className="text-sm font-medium text-violet-900">
        Page {page} of {totalPages}
      </span>

      {hasNext ? (
        <Link href={pageUrl(filters, page + 1)} className={buttonClasses}>
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClasses}>
          Next
        </span>
      )}
    </nav>
  );
}
