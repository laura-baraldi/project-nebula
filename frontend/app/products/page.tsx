import { Suspense } from "react";

import ProductCard from "@/components/ProductCard";

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

async function ProductsContent() {
  // Fetch products from our Express backend.
  const response = await fetch("http://localhost:4000/api/products?limit=30", {
    cache: "no-store",
  });

  // Stop rendering if the API request fails.
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

      <p className="mt-8 text-center text-sm text-violet-700">
        {data.total} products available
      </p>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">Loading products...</p>}>
      <ProductsContent />
    </Suspense>
  );
}
