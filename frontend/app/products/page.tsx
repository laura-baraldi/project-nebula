import CategoryFilters from "@/components/CategoryFilters";
import ProductCard from "@/components/ProductCard";
import ProductSearch from "@/components/ProductSearch";
import ProductSort from "@/components/ProductSort";
import ProductPagination from "@/components/ProductPagination";
import ProductEmptyState from "@/components/ProductEmptyState";
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

  const isEmpty = data.items.length === 0;

  const isPageOutOfRange = data.total > 0 && data.page > data.totalPages;

  return (
    <main className="min-h-screen bg-violet-50 px-6 py-16">
      <h1 className="text-center text-4xl font-bold text-violet-900">
        Explore the Galaxy
      </h1>

      <p className="mt-4 text-center text-violet-700">
        Discover extraordinary products from across the galaxy.
      </p>

      <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Desktop sidebar and mobile category menu. */}
        <CategoryFilters filters={filters} />

        <section aria-label="Product results" className="min-w-0">
          {/* Search within the catalog, preserving active filters. */}
          <ProductSearch filters={filters} />

          <div className="my-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-violet-700">
              {data.total} products available
            </p>

            <ProductSort filters={filters} />
          </div>

          {isEmpty ? (
            <ProductEmptyState isPageOutOfRange={isPageOutOfRange} />
          ) : (
            <>
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

              <ProductPagination
                filters={filters}
                page={data.page}
                totalPages={data.totalPages}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ProductsPage({ searchParams }: ProductsPageProps = {}) {
  return <ProductsContent searchParams={searchParams} />;
}
