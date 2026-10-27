import type { Cart } from "@/lib/cartApi";

export const CART_UPDATED_EVENT = "cart:updated";

// Notify other components when the backend returns an updated cart.
export function notifyCartUpdated(cart: Cart): void {
  window.dispatchEvent(
    new CustomEvent<Cart>(CART_UPDATED_EVENT, {
      detail: cart,
    }),
  );
}
