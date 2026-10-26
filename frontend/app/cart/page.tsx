"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { notifyCartUpdated } from "@/lib/cartEvents";

import {
  getCart,
  updateCartItem,
  removeCartItem,
  CartApiError,
  type Cart,
} from "@/lib/cartApi";

const MAX_QUANTITY = 20;

export default function CartPage() {
  // The backend is the source of truth for cart contents.
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Retrieve the persisted cart when the page loads.
  const loadCart = useCallback(async () => {
    try {
      const data = await getCart();
      setCart(data);
    } catch {
      setError("Could not load your cart. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void getCart()
      .then((data) => setCart(data))
      .catch(() => {
        setError("Could not load your cart. Please try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Use the updated cart returned by the backend.
  async function changeQuantity(productId: string, quantity: number) {
    if (pendingProductId !== null || quantity < 1 || quantity > MAX_QUANTITY) {
      return;
    }

    setPendingProductId(productId);
    setError("");

    try {
      const updatedCart = await updateCartItem(productId, quantity);
      setCart(updatedCart);
      notifyCartUpdated(updatedCart);
    } catch (err) {
      setError(
        err instanceof CartApiError
          ? err.message
          : "Could not update the quantity. Please try again.",
      );
    } finally {
      setPendingProductId(null);
    }
  }

  async function handleRemove(productId: string) {
    if (pendingProductId !== null) return;

    setPendingProductId(productId);
    setError("");

    try {
      const updatedCart = await removeCartItem(productId);
      setCart(updatedCart);
      notifyCartUpdated(updatedCart);
    } catch (err) {
      setError(
        err instanceof CartApiError
          ? err.message
          : "Could not remove the product. Please try again.",
      );
    } finally {
      setPendingProductId(null);
    }
  }

  return (
    <main className="min-h-screen bg-violet-50 px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/products"
          className="text-sm font-medium text-violet-700 hover:text-violet-900"
        >
          ← Continue shopping
        </Link>

        <h1 className="mt-8 text-4xl font-bold text-violet-950">Your Cart</h1>

        <p className="mt-3 text-violet-700">
          Your favorite discoveries from across the galaxy.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <p>{error}</p>

            {cart === null && (
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setError("");
                  void loadCart();
                }}
                className="mt-3 font-semibold underline"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <p role="status" className="mt-12 text-violet-700">
            Loading your cart...
          </p>
        ) : cart === null ? null : cart.items.length === 0 ? (
          <section className="mt-12 rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-violet-900">
              Your cart is empty
            </h2>

            <p className="mt-3 text-gray-600">
              No galactic treasures here yet!
            </p>

            <Link
              href="/products"
              className="mt-7 inline-block rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white hover:bg-violet-800"
            >
              Explore products
            </Link>
          </section>
        ) : (
          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section aria-label="Cart items" className="space-y-5">
              {cart.items.map((item) => {
                const isPending = pendingProductId === item.product_id;
                const isUpdating = pendingProductId !== null;

                return (
                  <article
                    key={item.product_id}
                    className="rounded-2xl bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-5 sm:flex-row">
                      <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-violet-100 sm:w-40">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            sizes="(max-width: 640px) 100vw, 160px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-violet-600">
                            No image available
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/products/${item.product_id}`}
                          className="text-xl font-semibold text-violet-950 hover:underline"
                        >
                          {item.name}
                        </Link>

                        <p className="mt-2 text-sm text-gray-600">
                          {item.price_pawstars} PWS each
                        </p>

                        {!item.is_available && (
                          <p className="mt-3 text-sm font-medium text-red-700">
                            Currently unavailable. You can reduce the quantity
                            or remove this item.
                          </p>
                        )}

                        <div className="mt-5 flex flex-wrap items-center gap-4">
                          <div
                            aria-label={`Quantity for ${item.name}`}
                            className="inline-flex items-center overflow-hidden rounded-xl border border-violet-200"
                          >
                            <button
                              type="button"
                              aria-label={`Decrease ${item.name} quantity`}
                              disabled={isUpdating || item.quantity <= 1}
                              onClick={() =>
                                void changeQuantity(
                                  item.product_id,
                                  item.quantity - 1,
                                )
                              }
                              className="px-4 py-2 text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              −
                            </button>

                            <span className="min-w-9 text-center font-medium text-violet-950">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              aria-label={`Increase ${item.name} quantity`}
                              disabled={
                                isUpdating ||
                                !item.is_available ||
                                item.quantity >= MAX_QUANTITY
                              }
                              onClick={() =>
                                void changeQuantity(
                                  item.product_id,
                                  item.quantity + 1,
                                )
                              }
                              className="px-4 py-2 text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => void handleRemove(item.product_id)}
                            className="text-sm font-medium text-red-700 hover:underline disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>

                        <p className="mt-4 text-sm font-semibold text-violet-900">
                          Subtotal: {item.subtotal_pawstars} PWS
                        </p>

                        {isPending && (
                          <p
                            role="status"
                            className="mt-2 text-sm text-violet-600"
                          >
                            Updating...
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-violet-950">
                Cart Summary
              </h2>

              <div className="mt-6 flex justify-between gap-4 border-t border-violet-100 pt-5">
                <span className="font-medium text-gray-700">Total</span>

                <span className="font-bold text-violet-900">
                  {cart.total_pawstars} PWS
                </span>
              </div>

              <p className="mt-5 text-xs leading-5 text-gray-500">
                Prices and availability are confirmed by the backend. Checkout
                is not available yet.
              </p>

              <button
                type="button"
                disabled
                className="mt-6 w-full rounded-xl bg-violet-700 px-5 py-3 text-center font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Proceed to Checkout
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
