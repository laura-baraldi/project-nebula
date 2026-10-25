import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import { generateCartToken, hashCartToken } from "../../src/cart-token.js";

// Integration tests must use the dedicated Neon testing database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not defined");
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
}

// Configure the database BEFORE importing the app and pool.
process.env.DATABASE_URL = testDatabaseUrl;

const { app } = await import("../../src/app.js");
const { pool } = await import("../../src/db/pool.js");

const ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

// Only our test carts will be deleted.
const createdCartIds: string[] = [];

async function createTestCart(token: string, expired = false): Promise<string> {
  const result = await pool.query(
    `INSERT INTO carts (token_hash, expires_at)
     VALUES (
       $1,
       NOW() + ($2::int * INTERVAL '1 day')
     )
     RETURNING id`,
    [hashCartToken(token), expired ? -1 : 7],
  );

  const cartId: string = result.rows[0].id;
  createdCartIds.push(cartId);

  return cartId;
}

async function findProduct(minimumStock = 1) {
  const result = await pool.query(
    `SELECT id, name, price_pawstars, stock_quantity
     FROM products
     WHERE is_active = TRUE
       AND stock_quantity >= $1
     ORDER BY id
     LIMIT 1`,
    [minimumStock],
  );

  expect(result.rows).toHaveLength(1);

  return result.rows[0] as {
    id: string;
    name: string;
    price_pawstars: number;
    stock_quantity: number;
  };
}

async function insertCartItem(
  cartId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)`,
    [cartId, productId, quantity],
  );
}

async function readQuantity(
  cartId: string,
  productId: string,
): Promise<number | undefined> {
  const result = await pool.query(
    `SELECT quantity
     FROM cart_items
     WHERE cart_id = $1
       AND product_id = $2`,
    [cartId, productId],
  );

  return result.rows[0]?.quantity;
}

function patchItem(productId: string, quantity: number, token?: string) {
  const req = request(app)
    .patch(`/api/cart/items/${productId}`)
    .set("Origin", ORIGIN)
    .send({ quantity });

  if (token) {
    req.set("Cookie", `cart_token=${token}`);
  }

  return req;
}

afterEach(async () => {
  try {
    for (const cartId of createdCartIds) {
      // Foreign-key cascade also deletes cart_items.
      await pool.query("DELETE FROM carts WHERE id = $1", [cartId]);
    }
  } finally {
    createdCartIds.length = 0;
  }
});

afterAll(async () => {
  await pool.end();
});

describe("PATCH /api/cart/items/:productId - PostgreSQL integration", () => {
  it("replaces the quantity instead of adding to it", async () => {
    const product = await findProduct(5);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    // Original quantity: 3
    await insertCartItem(cartId, product.id, 3);

    const response = await patchItem(product.id, 2, token);

    expect(response.status).toBe(200);

    // PATCH sets the quantity to 2, not 3 + 2 = 5.
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].quantity).toBe(2);

    expect(response.body.total_pawstars).toBe(product.price_pawstars * 2);

    // Verify PostgreSQL, not just the HTTP response.
    expect(await readQuantity(cartId, product.id)).toBe(2);

    // A successful PATCH renews the existing cookie.
    const cookies = response.headers["set-cookie"];
    const cookieText = Array.isArray(cookies)
      ? cookies.join("; ")
      : String(cookies);

    expect(cookieText).toContain(`cart_token=${token}`);
    expect(cookieText).toContain("HttpOnly");
  });

  it("increases an existing quantity when stock is sufficient", async () => {
    const product = await findProduct(5);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await insertCartItem(cartId, product.id, 2);

    const response = await patchItem(product.id, 5, token);

    expect(response.status).toBe(200);
    expect(response.body.items[0].quantity).toBe(5);

    expect(await readQuantity(cartId, product.id)).toBe(5);
  });

  it("does not create a cart when no cookie exists", async () => {
    const product = await findProduct();

    const response = await patchItem(product.id, 2);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects an expired cart without modifying its items", async () => {
    const product = await findProduct(3);
    const token = generateCartToken();
    const cartId = await createTestCart(token, true);

    await insertCartItem(cartId, product.id, 3);

    const response = await patchItem(product.id, 2, token);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    // Failed PATCH must not change quantity.
    expect(await readQuantity(cartId, product.id)).toBe(3);
  });

  it("rejects a product not present in the cart", async () => {
    const product = await findProduct();
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    const response = await patchItem(product.id, 2, token);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_ITEM_NOT_FOUND");

    expect(await readQuantity(cartId, product.id)).toBeUndefined();

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("renews the cart expiration after a successful PATCH", async () => {
    const product = await findProduct(3);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await insertCartItem(cartId, product.id, 2);

    // This cart currently expires in one hour.
    await pool.query(
      `UPDATE carts
       SET expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = $1`,
      [cartId],
    );

    const response = await patchItem(product.id, 3, token);

    expect(response.status).toBe(200);

    const result = await pool.query(
      `SELECT expires_at FROM carts WHERE id = $1`,
      [cartId],
    );

    const expiresAt = new Date(result.rows[0].expires_at).getTime();

    // The successful PATCH should renew expiration
    // to approximately seven days from now.
    expect(expiresAt).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it("rejects invalid quantity without changing PostgreSQL", async () => {
    const product = await findProduct(3);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await insertCartItem(cartId, product.id, 3);

    const response = await patchItem(product.id, 21, token);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    expect(await readQuantity(cartId, product.id)).toBe(3);
  });
});
