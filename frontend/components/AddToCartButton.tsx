"use client";

import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import {
  addCartItem,
  getCart,
  updateCartItem,
  removeCartItem,
  CartApiError,
} from "@/lib/cartApi";
import { notifyCartUpdated } from "@/lib/cartEvents";

type AddToCartButtonProps = {
  productId: string;
  productName: string;
  inStock: boolean;
  compact?: boolean;
};

const MAX_QUANTITY = 20;

export default function AddToCartButton({
  productId,
  productName,
  inStock,
  compact = false,
}: AddToCartButtonProps) {
  // Track the request status and user feedback.
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    let active = true;

    // Load the current quantity from the persisted cart.
    void getCart()
      .then((cart) => {
        if (!active) return;

        const item = cart.items.find(
          (cartItem) => cartItem.product_id === productId,
        );

        setQuantity(item?.quantity ?? 0);
      })
      .catch(() => {
        // Keep the add-to-cart control available if the initial read fails.
      });

    return () => {
      active = false;
    };
  }, [productId]);

  function showErrorMessage(text: string) {
    setIsError(true);
    setMessage(text);
  }

  async function handleAddToCart() {
    // Defensive guard: do not submit while loading
    // or when the product is out of stock.
    if (isLoading || !inStock || quantity >= MAX_QUANTITY) return;

    // Disable the button and clear feedback from previous attempts.
    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      // POST increases the cart quantity by one.
      // The backend validates stock and quantity limits.
      const updatedCart = await addCartItem(productId, 1);
      notifyCartUpdated(updatedCart);

      const updatedItem = updatedCart.items.find(
        (item) => item.product_id === productId,
      );

      setQuantity(updatedItem?.quantity ?? 0);
      setMessage("");
      setIsError(false);
    } catch (error) {
      // Display the backend's message when available.
      // Otherwise, use a generic message for unexpected errors.
      if (error instanceof CartApiError) {
        showErrorMessage(error.message);
      } else {
        showErrorMessage("Could not add the product. Please try again.");
      }
    } finally {
      // Always restore the button, whether the request succeeded or failed.
      setIsLoading(false);
    }
  }

  async function changeQuantity(nextQuantity: number) {
    if (
      isLoading ||
      !inStock ||
      nextQuantity < 0 ||
      nextQuantity > MAX_QUANTITY
    ) {
      return;
    }

    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      // Update or remove the item using the backend as the source of truth.
      const updatedCart =
        nextQuantity === 0
          ? await removeCartItem(productId)
          : await updateCartItem(productId, nextQuantity);

      notifyCartUpdated(updatedCart);

      const updatedItem = updatedCart.items.find(
        (item) => item.product_id === productId,
      );

      setQuantity(updatedItem?.quantity ?? 0);
    } catch (error) {
      if (error instanceof CartApiError) {
        showErrorMessage(error.message);
      } else {
        showErrorMessage("Could not update the quantity. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      {compact && quantity > 0 ? (
        <div
          aria-label={`Quantity for ${productName}`}
          className="inline-flex h-11 items-center overflow-hidden rounded-full border border-violet-200 bg-white shadow-sm"
        >
          <button
            type="button"
            aria-label={`Decrease ${productName} quantity`}
            disabled={isLoading}
            onClick={() => void changeQuantity(quantity - 1)}
            className="flex size-10 items-center justify-center text-lg text-violet-800 transition-colors hover:bg-violet-100 disabled:opacity-50"
          >
            −
          </button>

          <span
            aria-live="polite"
            className="min-w-5 text-center text-sm font-semibold text-violet-950"
          >
            {isLoading ? "…" : quantity}
          </span>

          <button
            type="button"
            aria-label={`Increase ${productName} quantity`}
            disabled={isLoading || quantity >= MAX_QUANTITY}
            onClick={() => void changeQuantity(quantity + 1)}
            className="flex size-10 items-center justify-center text-lg text-violet-800 transition-colors hover:bg-violet-100 disabled:opacity-50"
          >
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAddToCart}
          // Prevent normal clicks during loading or when out of stock.
          disabled={!inStock || isLoading}
          aria-label={
            compact
              ? `Add ${productName} to cart`
              : isLoading
                ? "Adding..."
                : inStock
                  ? "Add to Cart"
                  : "Out of stock"
          }
          title={compact ? "Add to cart" : undefined}
          className={
            compact
              ? "inline-flex size-11 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-violet-800 shadow-sm transition-all duration-200 hover:scale-105 hover:border-violet-700 hover:bg-violet-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              : "rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {/* Show the current state of the button. */}
          {isLoading ? (
            compact ? (
              "…"
            ) : (
              "Adding..."
            )
          ) : compact ? (
            <ShoppingCart size={19} strokeWidth={2} aria-hidden="true" />
          ) : inStock ? (
            "Add to Cart"
          ) : (
            "Out of stock"
          )}
        </button>
      )}

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`absolute right-0 top-full z-20 mt-1 w-max max-w-56 rounded-md bg-white px-2 py-1 text-right text-xs shadow-sm ${
            isError ? "text-red-700" : "text-green-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
