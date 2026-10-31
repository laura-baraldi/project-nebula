import Link from "next/link";
import type { CheckoutOrder } from "@/lib/checkoutApi";

type Props = {
  order: CheckoutOrder;
};

export default function OrderConfirmation({ order }: Props) {
  return (
    <main className="min-h-screen bg-violet-50 px-5 py-12 sm:px-8">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm sm:p-10">
        <div className="text-center">
          <div className="text-5xl" aria-hidden="true">
            ✨
          </div>

          <h1 className="mt-5 text-3xl font-bold text-violet-950">
            Order confirmed!
          </h1>

          <p className="mt-3 text-violet-700">
            Thank you! Your order has been created successfully.
          </p>
        </div>

        <div className="mt-8 rounded-xl bg-violet-50 p-5">
          <p className="text-sm text-violet-700">Order number</p>
          <p className="mt-1 text-2xl font-bold text-violet-950">
            {order.order_number}
          </p>

          <p className="mt-4 text-sm text-violet-700">Confirmation email</p>
          <p className="mt-1 font-medium text-violet-950">
            {order.customer_email}
          </p>
        </div>

        <h2 className="mt-8 text-lg font-semibold text-violet-950">
          Order summary
        </h2>

        <ul className="mt-4 space-y-4">
          {order.items.map((item, index) => (
            <li
              key={`${item.product_name}-${index}`}
              className="flex justify-between gap-4 text-sm"
            >
              <span className="text-gray-700">
                {item.product_name} × {item.quantity}
              </span>
              <span className="font-medium text-violet-950">
                {item.line_total_pawstars} PWS
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-between border-t border-violet-100 pt-5">
          <span className="font-semibold text-violet-950">Total</span>
          <span className="font-bold text-violet-950">
            {order.total_pawstars} PWS
          </span>
        </div>

        <p className="mt-5 text-xs text-gray-500">
          Payment is simulated. No real payment has been made.
        </p>

        <Link
          href="/products"
          className="mt-8 block rounded-xl bg-violet-700 px-6 py-3 text-center font-semibold text-white hover:bg-violet-800"
        >
          Continue shopping
        </Link>
      </section>
    </main>
  );
}
