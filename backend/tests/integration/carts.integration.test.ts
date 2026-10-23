import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

// These tests must connect to the separate Neon testing database.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not defined");
}

// Prevent accidental use of the normal application database.
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("Testing and application databases must be different");
}

describe("Shopping cart database integration", () => {
  let client: Client;
  let productId: string;

  beforeEach(async () => {
    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();

    // All changes made by this test are temporary.
    await client.query("BEGIN");

    // Use an existing product from the testing database.
    const result = await client.query(
      "SELECT id FROM products ORDER BY id LIMIT 1",
    );

    if (result.rows.length === 0) {
      throw new Error("The testing database needs at least one product");
    }

    productId = result.rows[0].id;
  });

  afterEach(async () => {
    // Undo every INSERT, UPDATE and DELETE performed by the test.
    // The testing database is left unchanged.
    await client.query("ROLLBACK");
    await client.end();
  });

  // Create a temporary cart inside the current transaction.
  async function createCart(): Promise<string> {
    const tokenHash = randomBytes(32).toString("hex");

    const result = await client.query(
      `INSERT INTO carts (token_hash, expires_at)
       VALUES ($1, now() + INTERVAL '7 days')
       RETURNING id`,
      [tokenHash],
    );

    return result.rows[0].id;
  }

  // PostgreSQL marks a transaction as failed after a constraint error.
  // SAVEPOINT allows us to recover and continue testing.
  async function expectDatabaseError(
    sql: string,
    values: unknown[],
    expectedCode: string,
  ) {
    await client.query("SAVEPOINT before_invalid_query");

    try {
      await expect(client.query(sql, values)).rejects.toMatchObject({
        code: expectedCode,
      });
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT before_invalid_query");
      await client.query("RELEASE SAVEPOINT before_invalid_query");
    }
  }

  it("creates a cart with an expiration date", async () => {
    const cartId = await createCart();

    const result = await client.query(
      `SELECT id, token_hash, expires_at
       FROM carts
       WHERE id = $1`,
      [cartId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].token_hash).toHaveLength(64);
    expect(result.rows[0].expires_at).toBeInstanceOf(Date);
  });

  it("accepts valid quantities between 1 and 20", async () => {
    const firstCart = await createCart();
    const secondCart = await createCart();

    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [firstCart, productId, 1],
    );

    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [secondCart, productId, 20],
    );

    const result = await client.query(
      `SELECT quantity
       FROM cart_items
       WHERE cart_id IN ($1, $2)
       ORDER BY quantity`,
      [firstCart, secondCart],
    );

    expect(result.rows.map((row) => row.quantity)).toEqual([1, 20]);
  });

  it("rejects quantities greater than 20", async () => {
    const cartId = await createCart();

    // PostgreSQL CHECK constraint violation: 23514.
    await expectDatabaseError(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [cartId, productId, 25],
      "23514",
    );
  });

  it("rejects quantities smaller than 1", async () => {
    const cartId = await createCart();

    await expectDatabaseError(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [cartId, productId, 0],
      "23514",
    );
  });

  it("rejects cart items referencing a nonexistent cart", async () => {
    // Foreign key violation: 23503.
    // Negative IDs cannot match generated positive cart IDs.
    await expectDatabaseError(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      ["-1", productId, 2],
      "23503",
    );
  });

  it("rejects cart items referencing a nonexistent product", async () => {
    const cartId = await createCart();

    await expectDatabaseError(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [cartId, "-1", 2],
      "23503",
    );
  });

  it("prevents duplicate products in the same cart", async () => {
    const cartId = await createCart();

    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [cartId, productId, 2],
    );

    // Unique constraint violation: 23505.
    await expectDatabaseError(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [cartId, productId, 3],
      "23505",
    );
  });

  it("deletes cart items automatically when their cart is deleted", async () => {
    const cartId = await createCart();

    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)`,
      [cartId, productId, 2],
    );

    // Delete the parent cart.
    await client.query("DELETE FROM carts WHERE id = $1", [cartId]);

    // ON DELETE CASCADE must also remove its cart items.
    const result = await client.query(
      "SELECT id FROM cart_items WHERE cart_id = $1",
      [cartId],
    );

    expect(result.rows).toHaveLength(0);

    // Deleting a cart must NOT delete its products.
    const product = await client.query(
      "SELECT id FROM products WHERE id = $1",
      [productId],
    );

    expect(product.rows).toHaveLength(1);
  });
});
