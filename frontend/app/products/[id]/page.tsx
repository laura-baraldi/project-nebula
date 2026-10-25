import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/AddToCartButton";

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
  // Read and validate the product ID.
  const { id } = await params;

  if (!/^[1-9]\d*$/.test(id) || BigInt(id) > MAX_PRODUCT_ID) {
    notFound();
  }

  // Retrieve product information from Express.
  const response = await fetch(`http://localhost:4000/api/products/${id}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error("Failed to load product details");
  }

  const product: Product = await response.json();

  const inStock = product.stock_quantity > 0;

  return (
    <main className="min-h-screen bg-violet-50 px-5 py-10 sm:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        {/* Breadcrumb navigation */}
        <nav aria-label="Breadcrumb" className="mb-10">
          <ol className="flex flex-wrap items-center gap-3 text-sm">
            <li>
              <Link
                href="/products"
                className="text-violet-600 transition-colors hover:text-violet-900"
              >
                Back to products
              </Link>
            </li>

            <li aria-hidden="true" className="text-violet-300">
              /
            </li>

            <li aria-current="page" className="font-medium text-violet-900">
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Main product layout */}
        <article className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          {/* Product image */}
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-violet-100">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-violet-500">
                No image available
              </div>
            )}
          </div>

          {/* Product information */}
          <div className="flex flex-col pt-2 lg:pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">
              {product.category}
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-violet-950 sm:text-5xl">
              {product.name}
            </h1>

            <p className="mt-7 text-2xl font-semibold tracking-tight text-violet-900">
              {product.price_pawstars} PWS
            </p>

            <div className="mt-8">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${
                  inStock
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    inStock ? "bg-green-600" : "bg-red-600"
                  }`}
                />

                {inStock ? "In stock" : "Out of stock"}
              </span>
            </div>

            <div className="mt-8">
              <AddToCartButton
                productId={id}
                productName={product.name}
                inStock={inStock}
              />
            </div>

            <div className="mt-10 border-t border-violet-200 pt-8">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-violet-900">
                About this product
              </h2>

              <p className="mt-5 max-w-prose text-base leading-8 text-gray-700">
                {product.description}
              </p>
            </div>

            <div className="mt-10 border-t border-violet-200 pt-6">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-500">Category</span>

                <span className="font-medium capitalize text-violet-900">
                  {product.category}
                </span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
