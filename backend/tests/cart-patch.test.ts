import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { generateCartToken } from "../src/cart-token.js";

// Prevent unit tests from connecting to PostgreSQL.
vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

// Mock repository functions while keeping the real Express route.
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
  };
});

import { app } from "../src/app.js";
import {
  CartBusinessError,
  getCartByTokenHash,
  updateCartItemQuantity,
} from "../src/db/cart.repository.js";

const mockUpdate = vi.mocked(updateCartItemQuantity);
const mockGet = vi.mocked(getCartByTokenHash);

const ORIGIN = "http://localhost:3000";
const TOKEN = generateCartToken();
const PRODUCT_ID = "5";

const UPDATED_CART = {
  items: [
    {
      product_id: PRODUCT_ID,
      name: "Moonwarm Bodysuit",
      image_url: null,
      price_pawstars: 3900,
      quantity: 2,
      subtotal_pawstars: 7800,
      is_available: true,
    },
  ],
  total_pawstars: 7800,
};

function patchCart(
  body: unknown = { quantity: 2 },
  token: string | null = TOKEN,
) {
  const req = request(app)
    .patch(`/api/cart/items/${PRODUCT_ID}`)
    .set("Origin", ORIGIN)
    .set("Content-Type", "application/json");

  if (token !== null) {
    req.set("Cookie", `cart_token=${token}`);
  }

  // Serialize the value into valid JSON, including null.
  return req.send(JSON.stringify(body));
}

beforeEach(() => {
  vi.resetAllMocks();

  mockUpdate.mockResolvedValue(undefined);
  mockGet.mockResolvedValue(UPDATED_CART);
});

describe("PATCH /api/cart/items/:productId", () => {
  it("replaces a quantity and returns HTTP 200", async () => {
    const response = await patchCart();

    expect(response.status).toBe(200);
    expect(response.body).toEqual(UPDATED_CART);

    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledWith(expect.any(String), PRODUCT_ID, 2);

    expect(mockGet).toHaveBeenCalledOnce();

    // Both operations must use the same token hash.
    expect(mockGet).toHaveBeenCalledWith(mockUpdate.mock.calls[0][0]);
  });

  it("renews the HttpOnly cart cookie after success", async () => {
    const response = await patchCart();

    expect(response.status).toBe(200);

    const cookies = response.headers["set-cookie"];

    expect(cookies).toBeDefined();

    const cookieHeader = Array.isArray(cookies)
      ? cookies.join("; ")
      : String(cookies);

    expect(cookieHeader).toContain(`cart_token=${TOKEN}`);
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=Lax");
  });

  it("accepts quantity 1", async () => {
    const response = await patchCart({ quantity: 1 });

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.any(String), PRODUCT_ID, 1);
  });

  it("accepts quantity 20", async () => {
    const response = await patchCart({ quantity: 20 });

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.any(String), PRODUCT_ID, 20);
  });

  it.each([
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 21 },
    { quantity: 1.5 },
    { quantity: "2" },
    { quantity: null },
    { quantity: true },
    { quantity: 2, price_pawstars: 1 },
    {},
    [],
  ])("rejects invalid JSON body %#", async (body) => {
    const response = await patchCart(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a JSON null body at the Express parser", async () => {
    const response = await patchCart(null);

    // Express rejects primitive JSON before the PATCH handler.
    expect(response.status).toBe(400);

    // The request must never reach the repository.
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();

    // A rejected request must not renew the cart cookie.
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it.each(["0", "-1", "abc", "1.5", "9223372036854775808"])(
    "rejects invalid product ID %s",
    async (id) => {
      const response = await request(app)
        .patch(`/api/cart/items/${id}`)
        .set("Origin", ORIGIN)
        .set("Cookie", `cart_token=${TOKEN}`)
        .send({ quantity: 2 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");

      expect(mockUpdate).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing cookie", async () => {
    const response = await patchCart({ quantity: 2 }, null);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a malformed cookie", async () => {
    const response = await patchCart({ quantity: 2 }, "invalid-token");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an untrusted Origin", async () => {
    const response = await request(app)
      .patch(`/api/cart/items/${PRODUCT_ID}`)
      .set("Origin", "https://malicious.example")
      .set("Cookie", `cart_token=${TOKEN}`)
      .send({ quantity: 2 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects requests without an Origin", async () => {
    const response = await request(app)
      .patch(`/api/cart/items/${PRODUCT_ID}`)
      .set("Cookie", `cart_token=${TOKEN}`)
      .send({ quantity: 2 });

    expect(response.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-JSON requests", async () => {
    const response = await request(app)
      .patch(`/api/cart/items/${PRODUCT_ID}`)
      .set("Origin", ORIGIN)
      .set("Cookie", `cart_token=${TOKEN}`)
      .set("Content-Type", "text/plain")
      .send("quantity=2");

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("handles a missing or expired cart", async () => {
    mockUpdate.mockRejectedValueOnce(
      new CartBusinessError(404, "CART_NOT_FOUND", "Cart not found."),
    );

    const response = await patchCart();

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");
    expect(mockGet).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("handles a product missing from the cart", async () => {
    mockUpdate.mockRejectedValueOnce(
      new CartBusinessError(
        404,
        "CART_ITEM_NOT_FOUND",
        "Product not found in cart.",
      ),
    );

    const response = await patchCart();

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_ITEM_NOT_FOUND");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("handles insufficient stock", async () => {
    mockUpdate.mockRejectedValueOnce(
      new CartBusinessError(
        409,
        "INSUFFICIENT_STOCK",
        "Not enough stock available.",
      ),
    );

    const response = await patchCart({ quantity: 15 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INSUFFICIENT_STOCK");

    expect(mockGet).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("handles an unavailable product", async () => {
    mockUpdate.mockRejectedValueOnce(
      new CartBusinessError(
        409,
        "PRODUCT_UNAVAILABLE",
        "Product is no longer available.",
      ),
    );

    const response = await patchCart();

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("PRODUCT_UNAVAILABLE");

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("returns 500 when the database update fails", async () => {
    mockUpdate.mockRejectedValueOnce(new Error("Private database error"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await patchCart();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update cart item.",
        },
      });

      // Never expose internal error details.
      expect(JSON.stringify(response.body)).not.toContain(
        "Private database error",
      );

      expect(mockGet).not.toHaveBeenCalled();
      expect(response.headers["set-cookie"]).toBeUndefined();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("returns 500 when reading the updated cart fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("Cart retrieval failed"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await patchCart();

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");

      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockGet).toHaveBeenCalledOnce();
      expect(response.headers["set-cookie"]).toBeUndefined();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
