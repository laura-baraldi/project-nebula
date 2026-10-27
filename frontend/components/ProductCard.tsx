import Image from "next/image";
import Link from "next/link";

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
  return (
    <article className="h-full overflow-hidden rounded-2xl bg-white shadow-sm">
      <Link
        href={`/products/${id}`}
        className="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
        aria-label={`View ${name} details`}
      >
        <div className="relative aspect-square w-full shrink-0 bg-violet-100">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />

          {stockQuantity <= 0 && (
            <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 shadow-md">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              Out of stock
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-6">
          <p className="text-sm uppercase text-violet-500">{category}</p>

          <h2 className="mt-3 text-xl font-bold text-violet-900">{name}</h2>

          <p className="mt-3 text-sm text-gray-600">{description}</p>

          <p className="mt-auto pt-5 font-semibold text-violet-700">
            {price} PWS
          </p>
        </div>
      </Link>
    </article>
  );
}
