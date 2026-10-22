import Link from "next/link";

type ProductEmptyStateProps = {
  isPageOutOfRange: boolean;
};

export default function ProductEmptyState({
  isPageOutOfRange,
}: ProductEmptyStateProps) {
  const title = isPageOutOfRange ? "Page not found" : "No products found";

  const description = isPageOutOfRange
    ? "There are no products on this page. Try going back to the beginning of the catalog."
    : "We couldn't find any products matching your filters. Try a different search or category.";

  return (
    <div
      role="status"
      className="rounded-2xl border border-violet-200 bg-white px-6 py-12 text-center shadow-sm"
    >
      <div aria-hidden="true" className="mb-4 text-5xl">
        {isPageOutOfRange ? "🪐" : "🔭"}
      </div>

      <h2 className="text-2xl font-bold text-violet-900">{title}</h2>

      <p className="mx-auto mt-3 max-w-md text-violet-700">{description}</p>

      <Link
        href="/products"
        className="mt-6 inline-block rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white transition-colors hover:bg-violet-800"
      >
        View all products
      </Link>
    </div>
  );
}
