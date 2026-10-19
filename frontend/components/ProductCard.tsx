type ProductCardProps = {
  name: string;
  description: string;
  category: string;
  price: number;
};

export default function ProductCard({
  name,
  description,
  category,
  price,
}: ProductCardProps) {
  return (
    <article className="rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm uppercase text-violet-500">{category}</p>

      <h2 className="mt-3 text-xl font-bold text-violet-900">{name}</h2>

      <p className="mt-3 text-sm text-gray-600">{description}</p>

      <p className="mt-5 font-semibold text-violet-700">{price} PWS</p>
    </article>
  );
}
