import Image from "next/image";

type ProductCardProps = {
  name: string;
  description: string;
  category: string;
  price: number;
  imageUrl: string;
};

export default function ProductCard({
  name,
  description,
  category,
  price,
  imageUrl,
}: ProductCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="relative aspect-square bg-violet-100">
        <Image
          src={imageUrl}
          alt={name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
      </div>

      <div className="p-6">
        <p className="text-sm uppercase text-violet-500">{category}</p>

        <h2 className="mt-3 text-xl font-bold text-violet-900">{name}</h2>

        <p className="mt-3 text-sm text-gray-600">{description}</p>

        <p className="mt-5 font-semibold text-violet-700">{price} PWS</p>
      </div>
    </article>
  );
}
