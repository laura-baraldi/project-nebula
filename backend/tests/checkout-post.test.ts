import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { generateCartToken, hashCartToken } from "../src/cart-token.js";

vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

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
    emptyCart: () => ({ items: [], total_pawstars: 0 }),
    getCartByTokenHash: vi.fn(),
    addCartItem: vi.fn(),
    updateCartItemQuantity: vi.fn(),
    removeCartItem: vi.fn(),
  };
});

vi.mock("../src/db/checkout/checkout.repository.js", () => ({
  checkout: vi.fn(),
}));

import { app } from "../src/app.js";
import { CartBusinessError } from "../src/db/cart.repository.js";
import { checkout } from "../src/db/checkout/checkout.repository.js";

const mockCheckout = vi.mocked(checkout);

const ORIGIN = "http://localhost:3000";
const TOKEN = generateCartToken();

const ORDER = {
  order_number: "ORD-123",
  customer_email: "test@example.com",
  total_pawstars: 200,
  payment_status: "simulated" as const,
};

function checkoutRequest(
  body: unknown = { customer_email: "test@example.com" },
  token: string | null = TOKEN,
) {
  const req = request(app)
    .post("/api/cart/checkout")
    .set("Origin", ORIGIN)
    .set("Content-Type", "application/json");

  if (token !== null) {
    req.set("Cookie", `cart_token=${token}`);
  }

  return req.send(JSON.stringify(body));
}

beforeEach(() => {
  vi.resetAllMocks();
  mockCheckout.mockResolvedValue(ORDER);
});

describe("POST /api/cart/checkout", () => {
  it("creates an order and returns HTTP 201", async () => {
    const response = await checkoutRequest();

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ order: ORDER });

    expect(mockCheckout).toHaveBeenCalledOnce();
    expect(mockCheckout).toHaveBeenCalledWith(
      hashCartToken(TOKEN),
      "test@example.com",
    );
  });

  it("renews the original HttpOnly cart cookie after success", async () => {
    const response = await checkoutRequest();

    expect(response.status).toBe(201);

    const cookies = response.headers["set-cookie"];
    expect(cookies).toBeDefined();

    const cookieHeader = Array.isArray(cookies)
      ? cookies.join("; ")
      : String(cookies);

    expect(cookieHeader).toContain(`cart_token=${TOKEN}`);
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toContain("SameSite=Lax");
    expect(cookieHeader).toContain("Path=/api/cart");
  });

  it("rejects requests from untrusted origins", async () => {
    const response = await request(app)
      .post("/api/cart/checkout")
      .set("Origin", "https://malicious.example")
      .send({ customer_email: "test@example.com" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it("rejects requests without an Origin", async () => {
    const response = await request(app)
      .post("/api/cart/checkout")
      .send({ customer_email: "test@example.com" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it("rejects non-JSON requests", async () => {
    const response = await request(app)
      .post("/api/cart/checkout")
      .set("Origin", ORIGIN)
      .set("Content-Type", "text/plain")
      .send("customer_email=test@example.com");

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it.each([
    [],
    {},
    { customer_email: 123 },
    { customer_email: null },
    { customer_email: "test@example.com", total: 200 },
    { email: "test@example.com" },
  ])("rejects an invalid request body %#", async (body) => {
    const response = await checkoutRequest(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockCheckout).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a JSON null body at the Express parser", async () => {
    const response = await checkoutRequest(null);

    expect(response.status).toBe(400);
    expect(mockCheckout).not.toHaveBeenCalled();
  });
  it("rejects a missing cart cookie", async () => {
    const response = await request(app)
      .post("/api/cart/checkout")
      .set("Origin", ORIGIN)
      .set("Content-Type", "application/json")
      .send({ customer_email: "test@example.com" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");
    expect(mockCheckout).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a malformed cart cookie", async () => {
    const response = await checkoutRequest(
      { customer_email: "test@example.com" },
      "invalid-token",
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");
    expect(mockCheckout).not.toHaveBeenCalled();
  });

  it("returns the repository validation error for an invalid email", async () => {
    mockCheckout.mockRejectedValueOnce(
      new CartBusinessError(
        400,
        "INVALID_EMAIL",
        "Provide a valid email address.",
      ),
    );

    const response = await checkoutRequest({
      customer_email: "not-an-email",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_EMAIL");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns a business error when the cart cannot be checked out", async () => {
    mockCheckout.mockRejectedValueOnce(
      new CartBusinessError(
        409,
        "INSUFFICIENT_STOCK",
        "There is not enough stock for a product in your cart.",
      ),
    );

    const response = await checkoutRequest();

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns HTTP 500 without exposing unexpected errors", async () => {
    mockCheckout.mockRejectedValueOnce(new Error("Private database error"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await checkoutRequest();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to checkout.",
        },
      });

      expect(JSON.stringify(response.body)).not.toContain(
        "Private database error",
      );

      expect(response.headers["set-cookie"]).toBeUndefined();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
