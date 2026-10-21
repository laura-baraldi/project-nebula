import { Suspense } from "react";

import CategoryFilters from "@/components/CategoryFilters";
import ProductCard from "@/components/ProductCard";
import { buildProductQuery, parseProductFilters } from "@/lib/productFilters";

type Product = {
  id: string;
  name: string;
  description: string;
  price_pawstars: number;
  category: string;
  image_url: string;
};

type ProductsResponse = {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SearchParameters = Record<string, string | string[] | undefined>;

type ProductsPageProps = {
  searchParams?: Promise<SearchParameters>;
};

export async function ProductsContent({
  searchParams,
}: ProductsPageProps = {}) {
  // Read the current URL parameters provided by Next.js.
  const params = searchParams ? await searchParams : {};

  // Validate filters before passing them to the Express backend.
  const filters = parseProductFilters(params);

  // Build the API query using only validated parameters.
  const query = buildProductQuery(filters);

  // Retrieve filtered, sorted and paginated products from Express.
  const response = await fetch(`http://localhost:4000/api/products?${query}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load products");
  }

  const data: ProductsResponse = await response.json();

  return (
    <main className="min-h-screen bg-violet-50 px-6 py-16">
      <h1 className="text-center text-4xl font-bold text-violet-900">
        Explore the Galaxy
      </h1>

      <p className="mt-4 text-center text-violet-700">
        Discover extraordinary products from across the galaxy.
      </p>

      {/* Mobile: filters above products. Desktop: sidebar to the left. */}
      <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <CategoryFilters filters={filters} />

        <section aria-label="Product results" className="min-w-0">
          <p className="mb-6 text-sm text-violet-700">
            {data.total} products available
          </p>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((product) => (
              <ProductCard
                key={product.id}
                name={product.name}
                description={product.description}
                category={product.category}
                price={product.price_pawstars}
                imageUrl={product.image_url}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ProductsPage({ searchParams }: ProductsPageProps = {}) {
  return (
    <Suspense fallback={<p className="p-8 text-center">Loading products...</p>}>
      <ProductsContent searchParams={searchParams} />
    </Suspense>
  );
}
