"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import Link from "next/link";

import { getCart, type Cart } from "@/lib/cartApi";
import { notifyCartUpdated } from "@/lib/cartEvents";
import {
  checkout,
  CheckoutApiError,
  type CheckoutOrder,
  type ShippingDetails,
} from "@/lib/checkoutApi";

import ContactInformation from "@/components/checkout/ContactInformation";
import ShippingAddressForm from "@/components/checkout/ShippingAddressForm";
import OrderSummary from "@/components/checkout/OrderSummary";
import OrderConfirmation from "@/components/checkout/OrderConfirmation";

export default function CheckoutPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [email, setEmail] = useState("");
  const [shipping, setShipping] = useState<ShippingDetails>({
    first_name: "",
    last_name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postal_code: "",
    country: "",
    phone: "",
  });

  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCart()
      .then(setCart)
      .catch(() => {
        setError("Could not load your cart. Please try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  function handleShippingChange(field: keyof ShippingDetails, value: string) {
    setShipping((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || !cart || cart.items.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const createdOrder = await checkout(email, shipping);
      setOrder(createdOrder);

      const emptyCart: Cart = {
        items: [],
        total_pawstars: 0,
      };

      setCart(emptyCart);
      notifyCartUpdated(emptyCart);
    } catch (err) {
      setError(
        err instanceof CheckoutApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-violet-50 px-5 py-12">
        <p role="status" className="text-center text-violet-700">
          Loading checkout...
        </p>
      </main>
    );
  }

  if (order) {
    return <OrderConfirmation order={order} />;
  }

  if (cart === null) {
    return (
      <main className="min-h-screen bg-violet-50 px-5 py-12">
        <p role="alert" className="text-center text-red-700">
          {error || "Could not load your cart."}
        </p>

        <Link
          href="/cart"
          className="mt-5 block text-center text-violet-700 underline"
        >
          Back to cart
        </Link>
      </main>
    );
  }

  if (cart.items.length === 0) {
    return (
      <main className="min-h-screen bg-violet-50 px-5 py-12">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-violet-950">
            Your cart is empty
          </h1>

          <p className="mt-3 text-gray-600">
            Add some products before proceeding to checkout.
          </p>

          <Link
            href="/products"
            className="mt-7 inline-block rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800"
          >
            Explore products
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-violet-50 px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/cart"
          className="text-sm font-medium text-violet-700 hover:text-violet-900"
        >
          ← Back to cart
        </Link>

        <h1 className="mt-8 text-4xl font-bold text-violet-950">Checkout</h1>

        <p className="mt-3 text-violet-700">
          Enter your contact and shipping details to complete your order.
        </p>

        <div
          role="note"
          className="mt-6 rounded-xl border-2 border-amber-500 bg-amber-100 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              ⚠️
            </span>

            <h2 className="text-lg font-extrabold text-amber-950">
              DEMO CHECKOUT — NO REAL PAYMENT
            </h2>
          </div>

          <p className="mt-3 font-semibold text-amber-950">
            This is a demonstration checkout. No real payment will be processed.
            No card details are required.
          </p>

          <div className="mt-4 rounded-lg border-2 border-amber-600 bg-amber-200 px-4 py-3">
            <p className="text-sm font-extrabold uppercase tracking-wide text-amber-950">
              Privacy notice — Please read
            </p>

            <p className="mt-1 text-sm font-bold leading-6 text-amber-950">
              Do not enter real personal information. Use fictional contact and
              shipping details for this demo checkout.
            </p>

            <p className="mt-2 text-sm font-medium leading-6 text-amber-950">
              The details submitted through this demo checkout are stored in the
              database to demonstrate the order flow.
            </p>
          </div>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-white p-6 shadow-sm sm:p-8"
          >
            <ContactInformation email={email} onEmailChange={setEmail} />

            <ShippingAddressForm
              shipping={shipping}
              onChange={handleShippingChange}
            />

            {error && (
              <p role="alert" className="mt-5 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-8 w-full rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Creating order..." : "Place order"}
            </button>
          </form>

          <OrderSummary cart={cart} />
        </div>
      </div>
    </main>
  );
}
