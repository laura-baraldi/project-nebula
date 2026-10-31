import type { Cart } from "@/lib/cartApi";

type Props = {
  cart: Cart;
  onPay: () => void;
  onBack: () => void;
  isSubmitting: boolean;
};

export default function PaymentStep({
  cart,
  onPay,
  onBack,
  isSubmitting,
}: Props) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-bold text-violet-950">Payment method</h2>

      <p className="mt-2 text-sm text-gray-600">
        Choose the demo payment method to complete your order.
      </p>

      <div className="mt-7 rounded-xl border-2 border-violet-500 bg-violet-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-violet-950">Demo card payment</p>
            <p className="mt-1 text-sm text-violet-700">
              Simulated transaction
            </p>
          </div>

          <span className="text-3xl" aria-hidden="true">
            💳
          </span>
        </div>

        <div className="mt-6 rounded-lg bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Demo card number
          </p>
          <p className="mt-1 font-mono text-lg tracking-widest text-violet-950">
            •••• •••• •••• 4242
          </p>

          <div className="mt-4 flex gap-10">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Cardholder
              </p>
              <p className="mt-1 text-sm font-medium text-violet-950">
                DEMO CUSTOMER
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Expires
              </p>
              <p className="mt-1 text-sm font-medium text-violet-950">12/30</p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-violet-800">
          This is a demonstration only. No card details are collected and no
          real payment will be processed.
        </p>
      </div>

      <div className="mt-8 rounded-xl bg-violet-50 p-5">
        <div className="flex justify-between gap-4">
          <span className="font-semibold text-violet-950">Amount to pay</span>
          <span className="text-xl font-bold text-violet-950">
            {cart.total_pawstars} PWS
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="rounded-xl border border-violet-200 px-6 py-3 font-semibold text-violet-800 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back to shipping
        </button>

        <button
          type="button"
          onClick={onPay}
          disabled={isSubmitting}
          className="rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Processing..." : "Pay now"}
        </button>
      </div>
    </section>
  );
}
