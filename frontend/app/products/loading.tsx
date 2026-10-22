export default function ProductsLoading() {
  return (
    <main className="min-h-screen bg-violet-50 px-6 py-16">
      <h1 className="text-center text-4xl font-bold text-violet-900">
        Explore the Galaxy
      </h1>

      <p className="mt-4 text-center text-violet-700">
        Discover extraordinary products from across the galaxy.
      </p>

      <div
        role="status"
        aria-label="Loading products"
        className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-[220px_minmax(0,1fr)]"
      >
        {/* Sidebar placeholder on desktop. */}
        <div
          aria-hidden="true"
          className="hidden h-72 animate-pulse rounded-2xl bg-violet-200 lg:block"
        />

        <div className="min-w-0">
          {/* Search and sorting placeholders. */}
          <div
            aria-hidden="true"
            className="mb-6 h-12 animate-pulse rounded-xl bg-violet-200"
          />

          <div
            aria-hidden="true"
            className="mb-6 h-10 w-48 animate-pulse rounded-xl bg-violet-200"
          />

          {/* Product card placeholders. */}
          <div
            aria-hidden="true"
            className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-violet-200 bg-white p-4"
              >
                <div className="aspect-square animate-pulse rounded-xl bg-violet-200" />

                <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-violet-200" />

                <div className="mt-3 h-4 w-full animate-pulse rounded bg-violet-100" />

                <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-violet-100" />

                <div className="mt-4 h-5 w-1/3 animate-pulse rounded bg-violet-200" />
              </div>
            ))}
          </div>
        </div>

        <span className="sr-only">Loading products...</span>
      </div>
    </main>
  );
}
