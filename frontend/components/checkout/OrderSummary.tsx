import type { Cart } from "@/lib/cartApi";

type Props = {
  cart: Cart;
};

export default function OrderSummary({ cart }: Props) {
  return (
    <aside className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-violet-950">Order summary</h2>

      <ul className="mt-6 space-y-4">
        {cart.items.map((item) => (
          <li
            key={item.product_id}
            className="flex justify-between gap-4 text-sm"
          >
            <span className="text-gray-700">
              {item.name} × {item.quantity}
            </span>
            <span className="font-medium text-violet-950">
              {item.subtotal_pawstars} PWS
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex justify-between gap-4 border-t border-violet-100 pt-5">
        <span className="font-semibold text-violet-950">Total</span>
        <span className="font-bold text-violet-950">
          {cart.total_pawstars} PWS
        </span>
      </div>
    </aside>
  );
}
