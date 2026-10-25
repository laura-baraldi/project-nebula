import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import { generateCartToken, hashCartToken } from "../../src/cart-token.js";

// Only the dedicated testing database may be used here.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not defined");
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("Testing and application databases must be different");
}

// The Express application reads DATABASE_URL when creating its Pool.
// Set it BEFORE importing app.ts or pool.ts.
process.env.DATABASE_URL = testDatabaseUrl;

const { app } = await import("../../src/app.js");
const { pool } = await import("../../src/db/pool.js");

// Track only carts created by these tests, so cleanup never
// deletes another user's cart or unrelated testing data.
const createdCartIds: string[] = [];

async function createTestCart(token: string, expired = false): Promise<string> {
  const expiresAt = expired
    ? new Date(Date.now() - 60_000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO carts (token_hash, expires_at)
     VALUES ($1, $2)
     RETURNING id`,
    [hashCartToken(token), expiresAt],
  );

  const cartId: string = result.rows[0].id;

  createdCartIds.push(cartId);

  return cartId;
}

afterEach(async () => {
  // The API uses its own database connections, so committed
  // test records must be deleted explicitly after each test.
  for (const cartId of createdCartIds) {
    // ON DELETE CASCADE removes the associated cart_items.
    await pool.query("DELETE FROM carts WHERE id = $1", [cartId]);
  }

  createdCartIds.length = 0;
});

afterAll(async () => {
  await pool.end();
});

describe("GET /api/cart - PostgreSQL integration", () => {
  it("returns an empty cart without a cookie", async () => {
    const response = await request(app).get("/api/cart");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });

    // Reading the cart must never create a cookie.
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns an empty cart for an unknown token", async () => {
    const token = generateCartToken();

    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", `cart_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });
  });

  it("does not return an expired cart", async () => {
    const token = generateCartToken();

    await createTestCart(token, true);

    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", `cart_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });
  });

  it("returns a real cart with current prices and totals", async () => {
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    // Read a real active product with sufficient stock.
    const products = await pool.query(
      `SELECT id, name, price_pawstars, image_url
       FROM products
       WHERE is_active = TRUE
         AND stock_quantity >= 2
       ORDER BY id
       LIMIT 1`,
    );

    expect(products.rows).toHaveLength(1);

    const product = products.rows[0];

    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [cartId, product.id, 2],
    );

    // Supertest sends a real HTTP request through Express,
    // which queries the real Neon testing database.
    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", `cart_token=${token}`);

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      items: [
        {
          product_id: product.id,
          name: product.name,
          image_url: product.image_url,
          price_pawstars: product.price_pawstars,
          quantity: 2,
          subtotal_pawstars: product.price_pawstars * 2,
          is_available: true,
        },
      ],
      total_pawstars: product.price_pawstars * 2,
    });

    // GET must not reset the seven-day cookie lifetime.
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns an existing cart with no items", async () => {
    const token = generateCartToken();

    await createTestCart(token);

    const response = await request(app)
      .get("/api/cart")
      .set("Cookie", `cart_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });
  });
});
