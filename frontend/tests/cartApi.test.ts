import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addCartItem,
  CartApiError,
  getCart,
  removeCartItem,
  updateCartItem,
  type Cart,
} from "../lib/cartApi";

const mockFetch = vi.fn();

const emptyCart: Cart = {
  items: [],
  total_pawstars: 0,
};

function mockSuccess(cart: Cart = emptyCart, status = 200) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify(cart), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Cart API client", () => {
  it("GET retrieves the cart and includes credentials", async () => {
    mockSuccess();

    const cart = await getCart();

    expect(cart).toEqual(emptyCart);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/cart$/),
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
      }),
    );
  });

  it("POST sends the product ID and quantity", async () => {
    mockSuccess(emptyCart, 201);

    await addCartItem("12", 2);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/cart\/items$/),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          product_id: "12",
          quantity: 2,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("POST defaults to quantity 1", async () => {
    mockSuccess();

    await addCartItem("12");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          product_id: "12",
          quantity: 1,
        }),
      }),
    );
  });

  it("PATCH replaces an item's quantity", async () => {
    mockSuccess();

    await updateCartItem("12", 3);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/cart\/items\/12$/),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ quantity: 3 }),
        credentials: "include",
      }),
    );
  });

  it("DELETE removes an item", async () => {
    mockSuccess();

    await removeCartItem("12");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/cart\/items\/12$/),
      expect.objectContaining({
        method: "DELETE",
        credentials: "include",
      }),
    );
  });

  it("preserves error status, code and message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "INSUFFICIENT_STOCK",
            message: "Not enough stock available.",
          },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(addCartItem("12", 5)).rejects.toMatchObject({
      name: "CartApiError",
      status: 409,
      code: "INSUFFICIENT_STOCK",
      message: "Not enough stock available.",
    });
  });

  it("handles server errors without a JSON body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Server unavailable", {
        status: 500,
      }),
    );

    try {
      await getCart();
      throw new Error("Expected the request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(CartApiError);
      expect(error).toMatchObject({
        status: 500,
        code: "UNKNOWN_ERROR",
        message: "Cart request failed.",
      });
    }
  });

  it("uses fallback error details when JSON has no error fields", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getCart()).rejects.toMatchObject({
      name: "CartApiError",
      status: 500,
      code: "UNKNOWN_ERROR",
      message: "Cart request failed.",
    });
  });
});
