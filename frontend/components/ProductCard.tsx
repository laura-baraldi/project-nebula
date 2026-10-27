import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";

type ProductCardProps = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
  stockQuantity: number;
};

export default function ProductCard({
  id,
  name,
  description,
  category,
  price,
  imageUrl,
  stockQuantity,
}: ProductCardProps) {
  const inStock = stockQuantity > 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg">
      <div className="relative aspect-square w-full shrink-0 bg-violet-100">
        <Link
          href={`/products/${id}`}
          aria-label={`View ${name} details`}
          className="absolute inset-0 focus-visible:outline-2 focus-visible:outline-violet-700"
        >
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </Link>

        {!inStock && (
          <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 shadow-md">
            <span className="h-2 w-2 rounded-full bg-red-600" />
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-500">
          {category}
        </p>

        <Link
          href={`/products/${id}`}
          aria-label={`View ${name} details`}
          className="mt-2 rounded-sm focus-visible:outline-2 focus-visible:outline-violet-700"
        >
          <h2 className="text-lg font-bold text-violet-900 transition-colors group-hover:text-violet-700">
            {name}
          </h2>
        </Link>

        <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>

        <div className="mt-auto flex min-h-12 items-center justify-between gap-3 pt-4">
          <p className="font-semibold text-violet-700">{price} PWS</p>

          {inStock && (
            <AddToCartButton
              productId={id}
              productName={name}
              inStock={inStock}
              compact
            />
          )}
        </div>
      </div>
    </article>
  );
}
