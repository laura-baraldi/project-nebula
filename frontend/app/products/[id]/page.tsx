import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type Product = {
  id: string;
  name: string;
  description: string;
  price_pawstars: number;
  category: string;
  stock_quantity: number;
  image_url: string | null;
};

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

const MAX_PRODUCT_ID = BigInt("9223372036854775807");

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  // Read the ID from the dynamic URL.
  const { id } = await params;

  // Reject invalid IDs before contacting the backend.
  if (!/^[1-9]\d*$/.test(id) || BigInt(id) > MAX_PRODUCT_ID) {
    notFound();
  }

  // Retrieve the requested product from Express.
  const response = await fetch(`http://localhost:4000/api/products/${id}`, {
    cache: "no-store",
  });

  // Missing or inactive products should display a 404 page.
  if (response.status === 404) {
    notFound();
  }

  // Unexpected API failures are handled by Next.js error boundaries.
  if (!response.ok) {
    throw new Error("Failed to load product details");
  }

  const product: Product = await response.json();

  const inStock = product.stock_quantity > 0;

  return (
    <main className="min-h-screen bg-violet-50 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/products"
          className="text-sm font-semibold text-violet-700 hover:text-violet-900"
        >
          ← Back to products
        </Link>

        <article className="mt-8 grid gap-10 overflow-hidden rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2 md:p-10">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-violet-100">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-violet-500">
                No image available
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-500">
              {product.category}
            </p>

            <h1 className="mt-3 text-3xl font-bold text-violet-900 md:text-4xl">
              {product.name}
            </h1>

            <p className="mt-6 text-2xl font-bold text-violet-700">
              {product.price_pawstars} PWS
            </p>

            <p className="mt-6 leading-7 text-gray-700">
              {product.description}
            </p>

            <p
              className={`mt-8 text-sm font-semibold ${
                inStock ? "text-green-700" : "text-red-700"
              }`}
            >
              {inStock ? "In stock" : "Out of stock"}
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
