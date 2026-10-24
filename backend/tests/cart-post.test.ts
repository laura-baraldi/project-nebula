import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { generateCartToken } from "../src/cart-token.js";

// Product routes also import the shared PostgreSQL pool.
vi.mock("../src/db/pool.js", () => ({
  pool: { query: vi.fn() },
}));

// Mock repository operations, but test the real Express route.
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
    addCartItem: vi.fn(),
    getCartByTokenHash: vi.fn(),
    emptyCart: () => ({ items: [], total_pawstars: 0 }),
  };
});

import { app } from "../src/app.js";
import {
  addCartItem,
  getCartByTokenHash,
  CartBusinessError,
} from "../src/db/cart.repository.js";

const mockAdd = vi.mocked(addCartItem);
const mockGet = vi.mocked(getCartByTokenHash);

const ORIGIN = "http://localhost:3000";

describe("POST /api/cart/items", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockGet.mockResolvedValue({
      items: [],
      total_pawstars: 0,
    });
  });

  it("rejects requests from untrusted origins", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", "https://malicious.example")
      .send({ product_id: "1", quantity: 2 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("rejects invalid quantities before accessing the database", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .send({ product_id: "1", quantity: 25 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockAdd).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects frontend-provided prices", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .send({
        product_id: "1",
        quantity: 2,
        price_pawstars: 1,
      });

    expect(response.status).toBe(400);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("creates a new cart and sets an HttpOnly cookie", async () => {
    mockAdd.mockResolvedValueOnce({ created: true });

    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .send({ product_id: "1", quantity: 2 });

    expect(response.status).toBe(201);
    expect(mockAdd).toHaveBeenCalledWith(
      null,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      "1",
      2,
    );

    const cookie = response.headers["set-cookie"]?.[0];

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/cart");
    expect(mockGet).toHaveBeenCalledOnce();
  });

  it("reuses the token of an existing cart", async () => {
    const token = generateCartToken();

    mockAdd.mockResolvedValueOnce({ created: false });

    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .set("Cookie", `cart_token=${token}`)
      .send({ product_id: "1", quantity: 2 });

    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]?.[0]).toContain(
      `cart_token=${token}`,
    );
  });

  it("returns 409 without setting a cookie when stock is insufficient", async () => {
    mockAdd.mockRejectedValueOnce(
      new CartBusinessError(
        409,
        "INSUFFICIENT_STOCK",
        "Not enough stock available.",
      ),
    );

    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .send({ product_id: "1", quantity: 20 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns HTTP 500 when adding an item fails unexpectedly", async () => {
    // Simulate an unexpected repository failure.
    mockAdd.mockRejectedValueOnce(new Error("Database unavailable"));

    // Prevent the expected error message from appearing in test output.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/api/cart/items")
        .set("Origin", ORIGIN)
        .send({ product_id: "1", quantity: 2 });

      expect(response.status).toBe(500);

      expect(response.body).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add cart item.",
        },
      });

      // No cookie must be created after a failed operation.
      expect(response.headers["set-cookie"]).toBeUndefined();

      // Never expose internal database error messages.
      expect(JSON.stringify(response.body)).not.toContain(
        "Database unavailable",
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("returns HTTP 500 when fetching the updated cart fails", async () => {
    // The addition succeeds, but retrieving the response fails.
    mockAdd.mockResolvedValueOnce({ created: true });
    mockGet.mockRejectedValueOnce(new Error("Cart retrieval failed"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .post("/api/cart/items")
        .set("Origin", ORIGIN)
        .send({ product_id: "1", quantity: 2 });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(mockAdd).toHaveBeenCalledOnce();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("returns HTTP 500 when GET cart retrieval fails", async () => {
    const token = generateCartToken();

    // Simulate a failure while reading the cart.
    mockGet.mockRejectedValueOnce(new Error("Database retrieval failed"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app)
        .get("/api/cart")
        .set("Cookie", `cart_token=${token}`);

      expect(response.status).toBe(500);

      expect(response.body).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch cart.",
        },
      });

      expect(JSON.stringify(response.body)).not.toContain(
        "Database retrieval failed",
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("rejects POST requests with a non-JSON Content-Type", async () => {
    // Send plain text instead of the required JSON.
    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .set("Content-Type", "text/plain")
      .send("product_id=1&quantity=2");

    expect(response.status).toBe(415);

    expect(response.body).toEqual({
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json.",
      },
    });

    // Invalid requests must not modify the database or set cookies.
    expect(mockAdd).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
