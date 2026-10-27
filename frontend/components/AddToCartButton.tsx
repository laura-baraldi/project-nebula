"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";

import {
  addCartItem,
  getCart,
  updateCartItem,
  removeCartItem,
  CartApiError,
  type Cart,
} from "@/lib/cartApi";
import { notifyCartUpdated } from "@/lib/cartEvents";

type AddToCartButtonProps = {
  productId: string;
  productName: string;
  inStock: boolean;
  compact?: boolean;
};

const MAX_QUANTITY = 20;

function getProductQuantity(cart: Cart, productId: string): number {
  return (
    cart.items.find((item) => item.product_id === productId)?.quantity ?? 0
  );
}

export default function AddToCartButton({
  productId,
  productName,
  inStock,
  compact = false,
}: AddToCartButtonProps) {
  const [quantity, setQuantity] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      try {
        const cart = await getCart();

        if (!cancelled) {
          setQuantity(getProductQuantity(cart, productId));
        }
      } catch {
        // The user can still try to add the product.
      }
    }

    void loadCart();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  function showError(error: unknown) {
    if (error instanceof CartApiError) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage("Could not update the cart. Please try again.");
    }
  }

  async function handleAddToCart() {
    if (isLoading || !inStock) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const updatedCart = await addCartItem(productId, 1);

      notifyCartUpdated(updatedCart);

      // Use the server quantity when available. The fallback also
      // keeps the UI correct when a response omits the product item.
      setQuantity(getProductQuantity(updatedCart, productId));
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function changeQuantity(nextQuantity: number) {
    if (isLoading || !inStock) return;
    if (nextQuantity < 0 || nextQuantity > MAX_QUANTITY) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const updatedCart =
        nextQuantity === 0
          ? await removeCartItem(productId)
          : await updateCartItem(productId, nextQuantity);

      notifyCartUpdated(updatedCart);
      setQuantity(getProductQuantity(updatedCart, productId));
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  if (quantity > 0 && inStock) {
    return (
      <div className="flex items-center gap-3">
        <div
          className={`inline-flex items-center rounded-full border border-violet-200 bg-white ${
            compact ? "gap-1 p-1" : "gap-3 p-2"
          }`}
          aria-label={`Quantity of ${productName}`}
        >
          <button
            type="button"
            onClick={() => void changeQuantity(quantity - 1)}
            disabled={isLoading}
            aria-label={`Decrease quantity of ${productName}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-violet-800 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Minus size={16} aria-hidden="true" />
          </button>

          <span
            aria-live="polite"
            aria-label={`Quantity: ${quantity}`}
            className="min-w-6 text-center font-semibold text-violet-900"
          >
            {quantity}
          </span>

          <button
            type="button"
            onClick={() => void changeQuantity(quantity + 1)}
            disabled={isLoading || quantity >= MAX_QUANTITY}
            aria-label={`Increase quantity of ${productName}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-violet-800 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>

        {errorMessage && (
          <p role="status" className="text-sm text-red-700">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void handleAddToCart()}
        disabled={!inStock || isLoading}
        aria-label={
          !inStock
            ? `Add ${productName} to cart`
            : compact
              ? `Add ${productName} to cart`
              : undefined
        }
        title={!inStock ? "Out of stock" : "Add to cart"}
        className={
          compact
            ? "inline-flex size-11 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-violet-800 shadow-sm transition-all duration-200 hover:scale-105 hover:border-violet-700 hover:bg-violet-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            : "inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {compact ? (
          <ShoppingCart size={19} aria-hidden="true" />
        ) : (
          <>
            <ShoppingCart size={18} aria-hidden="true" />
            {isLoading ? "Adding..." : inStock ? "Add to Cart" : "Out of stock"}
          </>
        )}
      </button>

      {errorMessage && (
        <p
          role="status"
          className="absolute right-0 top-full z-10 mt-2 w-max max-w-64 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
