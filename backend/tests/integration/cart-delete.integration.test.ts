import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";

import { generateCartToken, hashCartToken } from "../../src/cart-token.js";

// Use only the dedicated Neon testing database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not defined");
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
}

// Configure the connection before importing Express or the pool.
process.env.DATABASE_URL = testDatabaseUrl;

const { app } = await import("../../src/app.js");
const { pool } = await import("../../src/db/pool.js");

const ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

// Track test-created carts for cleanup.
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

  const id: string = result.rows[0].id;
  createdCartIds.push(id);
  return id;
}

async function findProducts(count = 1) {
  const result = await pool.query(
    `SELECT id, name, price_pawstars
     FROM products
     ORDER BY id
     LIMIT $1`,
    [count],
  );

  expect(result.rows.length).toBeGreaterThanOrEqual(count);

  return result.rows as Array<{
    id: string;
    name: string;
    price_pawstars: number;
  }>;
}

async function insertItem(
  cartId: string,
  productId: string,
  quantity = 2,
): Promise<void> {
  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     VALUES ($1, $2, $3)`,
    [cartId, productId, quantity],
  );
}

async function readItems(cartId: string) {
  const result = await pool.query(
    `SELECT product_id, quantity
     FROM cart_items
     WHERE cart_id = $1
     ORDER BY product_id`,
    [cartId],
  );

  return result.rows as Array<{
    product_id: string;
    quantity: number;
  }>;
}

async function readExpiration(cartId: string): Promise<number> {
  const result = await pool.query(
    `SELECT expires_at FROM carts WHERE id = $1`,
    [cartId],
  );

  return new Date(result.rows[0].expires_at).getTime();
}

function deleteItem(productId: string, token?: string) {
  const req = request(app)
    .delete(`/api/cart/items/${productId}`)
    .set("Origin", ORIGIN);

  if (token) {
    req.set("Cookie", `cart_token=${token}`);
  }

  return req;
}

afterEach(async () => {
  try {
    for (const id of createdCartIds) {
      // Cascade deletes cart_items, but not products.
      await pool.query("DELETE FROM carts WHERE id = $1", [id]);
    }
  } finally {
    createdCartIds.length = 0;
  }
});

afterAll(async () => {
  await pool.end();
});

describe("DELETE cart - PostgreSQL integration", () => {
  it("deletes the specified item from PostgreSQL", async () => {
    const [product] = await findProducts();
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await insertItem(cartId, product.id, 3);

    const response = await deleteItem(product.id, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });

    // The database row is genuinely gone.
    expect(await readItems(cartId)).toEqual([]);
  });

  it("leaves other cart items untouched", async () => {
    const [first, second] = await findProducts(2);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await insertItem(cartId, first.id, 2);
    await insertItem(cartId, second.id, 4);

    const response = await deleteItem(first.id, token);

    expect(response.status).toBe(200);

    // Only the second product remains.
    expect(await readItems(cartId)).toEqual([
      {
        product_id: second.id,
        quantity: 4,
      },
    ]);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      product_id: second.id,
      quantity: 4,
    });

    expect(response.body.total_pawstars).toBe(second.price_pawstars * 4);
  });

  it("keeps the cart when the last item is deleted", async () => {
    const [product] = await findProducts();
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await insertItem(cartId, product.id);

    const response = await deleteItem(product.id, token);

    expect(response.status).toBe(200);
    expect(await readItems(cartId)).toEqual([]);

    const cart = await pool.query(`SELECT id FROM carts WHERE id = $1`, [
      cartId,
    ]);

    // The cart remains in PostgreSQL.
    expect(cart.rows).toHaveLength(1);

    const cookies = response.headers["set-cookie"];
    const cookieText = Array.isArray(cookies)
      ? cookies.join("; ")
      : String(cookies);

    expect(cookieText).toContain(`cart_token=${token}`);
    expect(cookieText).toContain("HttpOnly");
  });

  it("rejects deletion without a cart cookie", async () => {
    const [product] = await findProducts();

    const response = await deleteItem(product.id);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("does not modify an expired cart", async () => {
    const [product] = await findProducts();
    const token = generateCartToken();
    const cartId = await createTestCart(token, true);

    await insertItem(cartId, product.id, 2);

    const originalExpiration = await readExpiration(cartId);

    const response = await deleteItem(product.id, token);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_NOT_FOUND");

    expect(await readItems(cartId)).toEqual([
      {
        product_id: product.id,
        quantity: 2,
      },
    ]);

    expect(await readExpiration(cartId)).toBe(originalExpiration);
  });

  it("does not renew expiration when the item is missing", async () => {
    const [product] = await findProducts();
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    const originalExpiration = await readExpiration(cartId);

    const response = await deleteItem(product.id, token);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CART_ITEM_NOT_FOUND");

    expect(await readItems(cartId)).toEqual([]);
    expect(await readExpiration(cartId)).toBe(originalExpiration);

    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("renews expiration after a successful deletion", async () => {
    const [product] = await findProducts();
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await insertItem(cartId, product.id);

    await pool.query(
      `UPDATE carts
       SET expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = $1`,
      [cartId],
    );

    const response = await deleteItem(product.id, token);

    expect(response.status).toBe(200);

    const expiration = await readExpiration(cartId);

    // The new expiration must be roughly seven days away.
    expect(expiration).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it("handles two concurrent DELETE requests safely", async () => {
    const [product] = await findProducts();
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await insertItem(cartId, product.id);

    // Both requests try deleting the same cart item.
    const [first, second] = await Promise.all([
      deleteItem(product.id, token),
      deleteItem(product.id, token),
    ]);

    const statuses = [first.status, second.status].sort();

    // One deletion succeeds; the other finds no item.
    expect(statuses).toEqual([200, 404]);

    const failed = first.status === 404 ? first : second;

    expect(failed.body.error.code).toBe("CART_ITEM_NOT_FOUND");

    // The cart remains valid and contains no items.
    expect(await readItems(cartId)).toEqual([]);

    const cart = await pool.query(`SELECT id FROM carts WHERE id = $1`, [
      cartId,
    ]);

    expect(cart.rows).toHaveLength(1);
  });
});
