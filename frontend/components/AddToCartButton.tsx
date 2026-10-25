"use client";

import { useState } from "react";
import { addCartItem, CartApiError } from "@/lib/cartApi";

type AddToCartButtonProps = {
  productId: string;
  productName: string;
  inStock: boolean;
};

export default function AddToCartButton({
  productId,
  productName,
  inStock,
}: AddToCartButtonProps) {
  // Track the request status and user feedback.
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleAddToCart() {
    // Defensive guard: do not submit while loading
    // or when the product is out of stock.
    if (isLoading || !inStock) return;

    // Disable the button and clear feedback from previous attempts.
    setIsLoading(true);
    setMessage("");
    setIsError(false);

    try {
      // POST increases the cart quantity by one.
      // The backend validates stock and quantity limits.
      await addCartItem(productId, 1);

      setMessage(`${productName} added to cart!`);
    } catch (error) {
      setIsError(true);

      // Display the backend's message when available.
      // Otherwise, use a generic message for unexpected errors.
      if (error instanceof CartApiError) {
        setMessage(error.message);
      } else {
        setMessage("Could not add the product. Please try again.");
      }
    } finally {
      // Always restore the button, whether the request succeeded or failed.
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleAddToCart}
        // Prevent normal clicks during loading or when out of stock.
        disabled={!inStock || isLoading}
        className="rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* Show the current state of the button. */}
        {isLoading ? "Adding..." : inStock ? "Add to Cart" : "Out of stock"}
      </button>

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-sm ${
            isError ? "text-red-700" : "text-green-700"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
