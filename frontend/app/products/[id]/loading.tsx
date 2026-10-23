export default function ProductDetailLoading() {
  return (
    <main className="min-h-screen bg-violet-50 px-5 py-10 sm:px-8 lg:py-16">
      <div
        role="status"
        aria-label="Loading product details"
        className="mx-auto max-w-6xl"
      >
        <span className="sr-only">Loading product details...</span>

        {/* Breadcrumb placeholder */}
        <div
          aria-hidden="true"
          className="mb-10 h-5 w-40 animate-pulse rounded bg-violet-200"
        />

        {/* Product layout */}
        <div
          aria-hidden="true"
          className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16"
        >
          {/* Large product image */}
          <div className="aspect-square animate-pulse rounded-2xl bg-violet-200" />

          {/* Product information */}
          <div className="flex flex-col pt-2 lg:pt-8">
            {/* Category */}
            <div className="h-4 w-24 animate-pulse rounded bg-violet-200" />

            {/* Product name */}
            <div className="mt-5 h-12 w-4/5 animate-pulse rounded bg-violet-200" />

            {/* Price */}
            <div className="mt-7 h-8 w-36 animate-pulse rounded bg-violet-200" />

            {/* Stock availability */}
            <div className="mt-8 h-9 w-28 animate-pulse rounded-full bg-violet-200" />

            {/* Description */}
            <div className="mt-10 border-t border-violet-200 pt-8">
              <div className="h-4 w-40 animate-pulse rounded bg-violet-200" />

              <div className="mt-5 space-y-3">
                <div className="h-4 w-full animate-pulse rounded bg-violet-100" />
                <div className="h-4 w-full animate-pulse rounded bg-violet-100" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-violet-100" />
              </div>
            </div>

            {/* Category details */}
            <div className="mt-10 border-t border-violet-200 pt-6">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 animate-pulse rounded bg-violet-100" />
                <div className="h-4 w-20 animate-pulse rounded bg-violet-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
