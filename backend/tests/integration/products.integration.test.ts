import { describe, expect, it } from "vitest";
import { Pool } from "pg";

describe("Products database integration", () => {
  it("connects to PostgreSQL and reads the products table", async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;

    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is not defined");
    }

    // Create a connection to the testing database.
    const pool = new Pool({ connectionString: testDatabaseUrl });

    try {
      // Execute a real SQL query without modifying any data.
      const result = await pool.query(
        "SELECT COUNT(*)::int AS total FROM products",
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].total).toBeGreaterThanOrEqual(0);
    } finally {
      // Always close the database connection.
      await pool.end();
    }
  });

  it("finds products by name regardless of case", async () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;

    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is not defined");
    }

    const pool = new Pool({ connectionString: testDatabaseUrl });

    try {
      const result = await pool.query(
        `SELECT name FROM products
       WHERE is_active = TRUE
       AND name ILIKE '%' || $1 || '%'`,
        ["MOON"],
      );

      expect(result.rows.length).toBeGreaterThan(0);

      for (const product of result.rows) {
        expect(product.name.toLowerCase()).toContain("moon");
      }
    } finally {
      await pool.end();
    }
  });
});
