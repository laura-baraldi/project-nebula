const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type CartItem = {
  product_id: string;
  name: string;
  image_url: string | null;
  price_pawstars: number;
  quantity: number;
  subtotal_pawstars: number;
  is_available: boolean;
};

export type Cart = {
  items: CartItem[];
  total_pawstars: number;
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class CartApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CartApiError";
  }
}

async function cartRequest(
  path: string,
  options: RequestInit = {},
): Promise<Cart> {
  const response = await fetch(`${API_BASE_URL}/api/cart${path}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });

  if (!response.ok) {
    let message = "Cart request failed.";
    let code = "UNKNOWN_ERROR";

    try {
      const data = (await response.json()) as ApiErrorResponse;

      message = data.error?.message ?? message;
      code = data.error?.code ?? code;
    } catch {
      // The server may return an empty or non-JSON error.
    }

    throw new CartApiError(response.status, code, message);
  }

  return (await response.json()) as Cart;
}

// GET: Read the current cart.
export function getCart(): Promise<Cart> {
  return cartRequest("");
}

// POST: Add a product or increase its quantity.
export function addCartItem(productId: string, quantity = 1): Promise<Cart> {
  return cartRequest("/items", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      quantity,
    }),
  });
}

// PATCH: Replace an existing item's quantity.
export function updateCartItem(
  productId: string,
  quantity: number,
): Promise<Cart> {
  return cartRequest(`/items/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

// DELETE: Remove an item.
export function removeCartItem(productId: string): Promise<Cart> {
  return cartRequest(`/items/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
}
