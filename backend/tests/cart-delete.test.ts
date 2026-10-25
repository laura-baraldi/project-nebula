import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { generateCartToken, hashCartToken } from "../src/cart-token.js";

// Unit tests: never connect to the real PostgreSQL database.
vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

// Mock database operations, but execute the real Express route.
vi.mock("../src/db/cart.repository.js", () => {
  class CartBusinessError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }

  return {
    CartBusinessError,
    emptyCart: () => ({
      items: [],
      total_pawstars: 0,
    }),
    getCartByTokenHash: vi.fn(),
    addCartItem: vi.fn(),
    updateCartItemQuantity: vi.fn(),
    removeCartItem: vi.fn(),
  };
});

import { app } from "../src/app.js";
import {
  CartBusinessError,
  getCartByTokenHash,
  removeCartItem,
} from "../src/db/cart.repository.js";

const mockRemove = vi.mocked(removeCartItem);
const mockGet = vi.mocked(getCartByTokenHash);

const ORIGIN = "http://localhost:3000";
const TOKEN = generateCartToken();
const PRODUCT_ID = "5";

const UPDATED_CART = {
  items: [
    {
      product_id: "8",
      name: "Stardust Pajamas",
      image_url: null,
      price_pawstars: 2400,
      quantity: 2,
      subtotal_pawstars: 4800,
      is_available: true,
    },
  ],
  total_pawstars: 4800,
};

const EMPTY_CART = {
  items: [],
  total_pawstars: 0,
};

function deleteItem(productId = PRODUCT_ID, token: string | null = TOKEN) {
  const req = request(app)
    .delete(`/api/cart/items/${productId}`)
    .set("Origin", ORIGIN);

  if (token !== null) {
    req.set("Cookie", `cart_token=${token}`);
  }

  return req;
}

beforeEach(() => {
  vi.resetAllMocks();

  mockRemove.mockResolvedValue(undefined);
  mockGet.mockResolvedValue(UPDATED_CART);
});

describe("DELETE /api/cart/items/:productId", () => {
  it("removes an item and returns HTTP 200", async () => {
    const response = await deleteItem();

    expect(response.status).toBe(200);
    expect(response.body).toEqual(UPDATED_CART);

    expect(mockRemove).toHaveBeenCalledOnce();
    expect(mockRemove).toHaveBeenCalledWith(hashCartToken(TOKEN), PRODUCT_ID);

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith(hashCartToken(TOKEN));
  });

  it("returns an empty cart when the last item is removed", async () => {
    mockGet.mockResolvedValueOnce(EMPTY_CART);

    const response = await deleteItem();

    expect(response.status).toBe(200);
    expect(response.body).toEqual(EMPTY_CART);
    expect(mockRemove).toHaveBeenCalledOnce();

    // Removing the last item does not destroy the cart.
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("renews the HttpOnly cookie after a successful DELETE", async () => {
    const response = await deleteItem();

    expect(response.status).toBe(200);

    const header = response.headers["set-cookie"];
    const cookieText = Array.isArray(header)
      ? header.join("; ")
      : String(header);

    expect(cookieText).toContain(`cart_token=${TOKEN}`);
    expect(cookieText).toContain("HttpOnly");
    expect(cookieText).toContain("SameSite=Lax");
    expect(cookieText).toContain("Path=/api/cart");
  });

  it("does not require a JSON request body", async () => {
    const response = await deleteItem();

    expect(response.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledOnce();
  });

  it.each(["0", "-1", "abc", "1.5", "9223372036854775808"])(
    "rejects invalid product ID %s",
    async (productId) => {
      const response = await deleteItem(productId);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid product ID.",
        },
      });

      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockGet).not.toHaveBeenCalled();
      expect(response.headers["set-cookie"]).toBeUndefined();
    },
  );

  it("accepts the maximum valid PostgreSQL BIGINT ID", async () => {
    const productId = "9223372036854775807";

    const response = await deleteItem(productId);

    expect(response.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith(hashCartToken(TOKEN), productId);
  });

  it("rejects requests without a cookie", async () => {
    const response = await deleteItem(PRODUCT_ID, null);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a malformed cart cookie", async () => {
    const response = await deleteItem(PRODUCT_ID, "invalid-token");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("rejects an untrusted Origin", async () => {
    const response = await request(app)
      .delete(`/api/cart/items/${PRODUCT_ID}`)
      .set("Origin", "https://malicious.example")
      .set("Cookie", `cart_token=${TOKEN}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");

    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("rejects requests without an Origin", async () => {
    const response = await request(app)
      .delete(`/api/cart/items/${PRODUCT_ID}`)
      .set("Cookie", `cart_token=${TOKEN}`);

    expect(response.status).toBe(403);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("handles an unknown or expired cart", async () => {
    mockRemove.mockRejectedValueOnce(
      new CartBusinessError(404, "CART_NOT_FOUND", "Cart not found."),
    );

    const response = await deleteItem();

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    expect(mockGet).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("handles a product not present in the cart", async () => {
    mockRemove.mockRejectedValueOnce(
      new CartBusinessError(
        404,
        "CART_ITEM_NOT_FOUND",
        "Product not found in cart.",
      ),
    );

    const response = await deleteItem();

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_ITEM_NOT_FOUND");

    expect(mockGet).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns HTTP 500 when deleting the item fails", async () => {
    mockRemove.mockRejectedValueOnce(new Error("Private database failure"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await deleteItem();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to remove cart item.",
        },
      });

      // Internal database details must not be exposed.
      expect(JSON.stringify(response.body)).not.toContain(
        "Private database failure",
      );

      expect(mockGet).not.toHaveBeenCalled();
      expect(response.headers["set-cookie"]).toBeUndefined();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("returns HTTP 500 when fetching the updated cart fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("Failed to retrieve cart"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await deleteItem();

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");

      expect(mockRemove).toHaveBeenCalledOnce();
      expect(mockGet).toHaveBeenCalledOnce();
      expect(response.headers["set-cookie"]).toBeUndefined();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
