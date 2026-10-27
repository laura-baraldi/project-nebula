"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCart, type Cart } from "@/lib/cartApi";
import { CART_UPDATED_EVENT } from "@/lib/cartEvents";

function countItems(cart: Cart): number {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}

export default function CartLink() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let receivedUpdate = false;

    function handleCartUpdated(event: Event) {
      receivedUpdate = true;

      const updatedCart = (event as CustomEvent<Cart>).detail;
      setCount(countItems(updatedCart));
    }

    window.addEventListener(CART_UPDATED_EVENT, handleCartUpdated);

    // Load the persisted cart when the navigation appears.
    void getCart()
      .then((cart) => {
        if (active && !receivedUpdate) {
          setCount(countItems(cart));
        }
      })
      .catch(() => {
        // Keep the count unknown rather than showing an incorrect zero.
      });

    return () => {
      active = false;
      window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdated);
    };
  }, []);

  return (
    <Link
      href="/cart"
      aria-label="View shopping cart"
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-violet-900 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
    >
      <ShoppingCart size={24} aria-hidden="true" />

      {count !== null && count > 0 && (
        <span
          aria-label={`${count} items in cart`}
          className="rounded-full bg-violet-700 px-2 py-0.5 text-xs font-semibold text-white"
        >
          {count}
        </span>
      )}

      <span>Cart</span>
    </Link>
  );
}
