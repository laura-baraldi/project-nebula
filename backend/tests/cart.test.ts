import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { generateCartToken, hashCartToken } from "../src/cart-token.js";

// Replace PostgreSQL with a mock for isolated API tests.
vi.mock("../src/db/pool.js", () => ({
  pool: { query: vi.fn() },
}));

import { pool } from "../src/db/pool.js";
import { app } from "../src/app.js";

const mockQuery = vi.mocked(pool.query);

describe("GET /api/cart", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns an empty cart without a cookie", async () => {
    const response = await request(app).get("/api/cart");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns an empty cart for a malformed token", async () => {
    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", "cart_token=invalid");

    expect(response.status).toBe(200);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns an empty cart for an unknown or expired token", async () => {
    const token = generateCartToken();

    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", `cart_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("expires_at > NOW()"),
      [hashCartToken(token)],
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("returns current product prices and calculated totals", async () => {
    const token = generateCartToken();

    // First query identifies the cart.
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "10" }],
    } as never);

    // Second query returns the products in that cart.
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          product_id: "1",
          name: "Moonwarm Bodysuit",
          image_url: "/products/clothing/moonwarm-bodysuit.webp",
          price_pawstars: 3900,
          stock_quantity: 18,
          is_active: true,
          quantity: 2,
        },
        {
          product_id: "2",
          name: "Stardust Pajamas",
          image_url: null,
          price_pawstars: 2400,
          stock_quantity: 0,
          is_active: true,
          quantity: 1,
        },
      ],
    } as never);

    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", `cart_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.total_pawstars).toBe(10200);
    expect(response.body.items).toHaveLength(2);

    expect(response.body.items[0]).toMatchObject({
      product_id: "1",
      quantity: 2,
      subtotal_pawstars: 7800,
      is_available: true,
    });

    // Insufficient stock must not remove an existing item.
    expect(response.body.items[1]).toMatchObject({
      product_id: "2",
      subtotal_pawstars: 2400,
      is_available: false,
    });

    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("JOIN products"),
      ["10"],
    );

    // GET must not renew the cookie.
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("keeps inactive products visible but unavailable", async () => {
    const token = generateCartToken();

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "10" }],
    } as never);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          product_id: "1",
          name: "Moonwarm Bodysuit",
          image_url: null,
          price_pawstars: 3900,
          stock_quantity: 18,
          is_active: false,
          quantity: 1,
        },
      ],
    } as never);

    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", `cart_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items[0].is_available).toBe(false);
  });

  it("returns an empty valid cart", async () => {
    const token = generateCartToken();

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "10" }],
    } as never);

    mockQuery.mockResolvedValueOnce({
      rows: [],
    } as never);

    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", `cart_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });
  });

  it("returns HTTP 500 without exposing database errors", async () => {
    const token = generateCartToken();

    mockQuery.mockRejectedValueOnce(new Error("Sensitive database error"));

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
      expect(JSON.stringify(response.body)).not.toContain("Sensitive");
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
