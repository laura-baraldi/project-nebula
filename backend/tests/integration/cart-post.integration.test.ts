import { afterAll, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { generateCartToken, hashCartToken } from "../../src/cart-token.js";

// Never use the normal application database for these tests.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not defined");
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("Testing and application databases must be different");
}

// app.ts reads DATABASE_URL when its PostgreSQL pool is created.
// During this test process, give it the TESTING connection.
// This does not modify the .env file or copy database contents.
process.env.DATABASE_URL = testDatabaseUrl;

const { app } = await import("../../src/app.js");
const { pool } = await import("../../src/db/pool.js");

const ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

// Record token hashes belonging to test carts only.
// Cleanup will never deliberately delete unrelated carts.
const testTokenHashes = new Set<string>();

function registerToken(token: string): void {
  testTokenHashes.add(hashCartToken(token));
}

// Create a committed test cart that Express can see
// through its own PostgreSQL connections.
async function createTestCart(token: string): Promise<string> {
  const hash = hashCartToken(token);
  registerToken(token);

  const result = await pool.query(
    `INSERT INTO carts (token_hash, expires_at)
     VALUES ($1, NOW() + INTERVAL '7 days')
     RETURNING id`,
    [hash],
  );

  return result.rows[0].id;
}

// Choose products from the TEST database.
// We do not modify the catalog or its stock.
async function findProduct(minStock: number, maxStock?: number) {
  const result = await pool.query(
    `SELECT id, name, price_pawstars, stock_quantity
     FROM products
     WHERE is_active = TRUE
       AND stock_quantity >= $1
       AND ($2::int IS NULL OR stock_quantity <= $2)
     ORDER BY id
     LIMIT 1`,
    [minStock, maxStock ?? null],
  );

  expect(result.rows).toHaveLength(1);

  return result.rows[0] as {
    id: string;
    name: string;
    price_pawstars: number;
    stock_quantity: number;
  };
}

// Read the cart token set by Express after a successful POST.
function extractCookieToken(response: {
  headers: Record<string, unknown>;
}): string {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header) ? header : [header];

  const cartCookie = cookies.find(
    (value): value is string =>
      typeof value === "string" && value.startsWith("cart_token="),
  );

  expect(cartCookie).toBeDefined();

  const token = cartCookie?.match(/^cart_token=([0-9a-f]{64})/)?.[1];

  expect(token).toBeDefined();

  return token!;
}

afterEach(async () => {
  // Delete only carts identified by our test-generated hashes.
  // ON DELETE CASCADE also removes their cart_items.
  try {
    for (const hash of testTokenHashes) {
      await pool.query("DELETE FROM carts WHERE token_hash = $1", [hash]);
    }
  } finally {
    testTokenHashes.clear();
  }
});

afterAll(async () => {
  await pool.end();
});

describe("POST /api/cart/items - PostgreSQL integration", () => {
  it("creates a new cart and stores the product", async () => {
    const product = await findProduct(2);

    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .send({
        product_id: product.id,
        quantity: 2,
      });

    // Register the new token for automatic cleanup.
    expect(response.status).toBe(201);

    const token = extractCookieToken(response);
    registerToken(token);

    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      product_id: product.id,
      quantity: 2,
      subtotal_pawstars: product.price_pawstars * 2,
    });

    expect(response.body.total_pawstars).toBe(product.price_pawstars * 2);

    // Confirm the cart and item really exist in PostgreSQL.
    const saved = await pool.query(
      `SELECT c.id, ci.quantity
       FROM carts AS c
       JOIN cart_items AS ci ON ci.cart_id = c.id
       WHERE c.token_hash = $1
         AND ci.product_id = $2`,
      [hashCartToken(token), product.id],
    );

    expect(saved.rows).toHaveLength(1);
    expect(saved.rows[0].quantity).toBe(2);
  });

  it("increases the quantity in an existing cart", async () => {
    const product = await findProduct(5);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, 2)`,
      [cartId, product.id],
    );

    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .set("Cookie", `cart_token=${token}`)
      .send({
        product_id: product.id,
        quantity: 3,
      });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].quantity).toBe(5);

    // The original token is reused.
    expect(extractCookieToken(response)).toBe(token);

    const rows = await pool.query(
      `SELECT quantity
       FROM cart_items
       WHERE cart_id = $1 AND product_id = $2`,
      [cartId, product.id],
    );

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].quantity).toBe(5);
  });

  it("rejects an unknown product without creating a cart", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .send({
        product_id: "9223372036854775807",
        quantity: 1,
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PRODUCT_NOT_FOUND");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rolls back when the quantity limit is exceeded", async () => {
    const product = await findProduct(20);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, 19)`,
      [cartId, product.id],
    );

    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .set("Cookie", `cart_token=${token}`)
      .send({
        product_id: product.id,
        quantity: 2,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("QUANTITY_LIMIT_EXCEEDED");

    // 19 + 2 = 21. The failed operation must leave 19.
    const result = await pool.query(
      `SELECT quantity FROM cart_items
       WHERE cart_id = $1 AND product_id = $2`,
      [cartId, product.id],
    );

    expect(result.rows[0].quantity).toBe(19);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects insufficient stock without changing the cart", async () => {
    // Pick a real product whose stock is below the quantity limit.
    const product = await findProduct(1, 19);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [cartId, product.id, product.stock_quantity],
    );

    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .set("Cookie", `cart_token=${token}`)
      .send({
        product_id: product.id,
        quantity: 1,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INSUFFICIENT_STOCK");

    const result = await pool.query(
      `SELECT quantity FROM cart_items
       WHERE cart_id = $1 AND product_id = $2`,
      [cartId, product.id],
    );

    // The original quantity must remain unchanged.
    expect(result.rows[0].quantity).toBe(product.stock_quantity);
  });

  it("renews cart expiration after a successful addition", async () => {
    const product = await findProduct(2);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    // Make the existing cart expire in one hour.
    await pool.query(
      `UPDATE carts
       SET expires_at = NOW() + INTERVAL '1 hour'
       WHERE id = $1`,
      [cartId],
    );

    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", ORIGIN)
      .set("Cookie", `cart_token=${token}`)
      .send({
        product_id: product.id,
        quantity: 1,
      });

    expect(response.status).toBe(200);

    const result = await pool.query(
      `SELECT expires_at
       FROM carts
       WHERE id = $1`,
      [cartId],
    );

    const expiresAt = new Date(result.rows[0].expires_at).getTime();

    // Seven-day renewal should be well beyond one hour.
    expect(expiresAt).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it("handles concurrent additions without losing quantities", async () => {
    const product = await findProduct(3);
    const token = generateCartToken();
    const cartId = await createTestCart(token);

    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, 1)`,
      [cartId, product.id],
    );

    // Both requests attempt to modify the SAME cart.
    // Each request uses its own PostgreSQL transaction.
    const [first, second] = await Promise.all([
      request(app)
        .post("/api/cart/items")
        .set("Origin", ORIGIN)
        .set("Cookie", `cart_token=${token}`)
        .send({ product_id: product.id, quantity: 1 }),

      request(app)
        .post("/api/cart/items")
        .set("Origin", ORIGIN)
        .set("Cookie", `cart_token=${token}`)
        .send({ product_id: product.id, quantity: 1 }),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const result = await pool.query(
      `SELECT quantity
       FROM cart_items
       WHERE cart_id = $1 AND product_id = $2`,
      [cartId, product.id],
    );

    // Starting quantity 1 + two additions = 3.
    // Neither request should overwrite the other.
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].quantity).toBe(3);
  });
});
