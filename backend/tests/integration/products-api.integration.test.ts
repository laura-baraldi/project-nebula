import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";

// Integration tests must use the dedicated Neon testing branch.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not defined");
}

// The application reads DATABASE_URL when initializing its Pool.
// Set it to the testing database before importing the application.
process.env.DATABASE_URL = testDatabaseUrl;

// Dynamic imports ensure the Pool uses the testing connection.
const { app } = await import("../../src/app.js");
const { pool } = await import("../../src/db/pool.js");

// Close all PostgreSQL connections after the tests finish.
afterAll(async () => {
  await pool.end();
});

// PostgreSQL BIGINT identifiers are serialized as strings.
type Product = {
  id: string;
  name: string;
  category: string;
  price_pawstars: number;
  is_active: boolean;
};

type ProductsResponse = {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

describe("Products API integration", () => {
  it("returns real products with the expected pagination metadata", async () => {
    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);

    const body = response.body as ProductsResponse;

    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
    expect(body.page).toBe(1);
    expect(body.limit).toBeGreaterThan(0);
    expect(body.totalPages).toBe(Math.ceil(body.total / body.limit));
  });

  it("paginates real products without repeating IDs", async () => {
    // Request two consecutive pages from the database.
    const first = await request(app).get("/api/products?page=1&limit=5");
    const second = await request(app).get("/api/products?page=2&limit=5");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstBody = first.body as ProductsResponse;
    const secondBody = second.body as ProductsResponse;

    expect(firstBody.items).toHaveLength(5);
    expect(secondBody.items).toHaveLength(5);

    expect(firstBody.page).toBe(1);
    expect(secondBody.page).toBe(2);
    expect(firstBody.total).toBe(secondBody.total);

    const firstIds = new Set(firstBody.items.map((p) => p.id));
    const secondIds = secondBody.items.map((p) => p.id);

    // LIMIT and OFFSET must return different products.
    for (const id of secondIds) {
      expect(firstIds.has(id)).toBe(false);
    }
  });

  it("filters products by category", async () => {
    // Select a category that actually exists in the testing database.
    const initial = await request(app).get("/api/products?limit=50");

    expect(initial.status).toBe(200);

    const initialBody = initial.body as ProductsResponse;
    expect(initialBody.items.length).toBeGreaterThan(0);

    const category = initialBody.items[0].category;

    const response = await request(app)
      .get("/api/products")
      .query({ category, limit: 50 });

    expect(response.status).toBe(200);

    const body = response.body as ProductsResponse;

    expect(body.items.length).toBeGreaterThan(0);

    for (const product of body.items) {
      expect(product.category).toBe(category);
    }
  });

  it("applies category and price filters together", async () => {
    // Select a stable product from the actual catalog.
    // Other integration tests may create and delete temporary
    // products in the "test" category while this test runs.
    const reference = await pool.query<Product>(
      `SELECT id, name, category, price_pawstars, is_active
     FROM products
     WHERE is_active = TRUE
       AND category IN (
         'accessories', 'clothing', 'food', 'home',
         'skincare', 'tech', 'toys', 'travel'
       )
     ORDER BY id
     LIMIT 1`,
    );

    expect(reference.rows).toHaveLength(1);

    const referenceProduct = reference.rows[0];
    const category = referenceProduct.category;
    const price = referenceProduct.price_pawstars;

    // Filter simultaneously by category and exact price.
    const response = await request(app).get("/api/products").query({
      category,
      min_price: price,
      max_price: price,
      limit: 50,
    });

    expect(response.status).toBe(200);

    const body = response.body as ProductsResponse;

    // The selected catalog product must match both filters.
    expect(body.items.length).toBeGreaterThan(0);

    for (const product of body.items) {
      expect(product.category).toBe(category);
      expect(product.price_pawstars).toBe(price);
    }

    expect(
      body.items.some((product) => product.id === referenceProduct.id),
    ).toBe(true);
  });

  it("searches product names without case sensitivity", async () => {
    // Use a real product name to avoid relying on hardcoded seed names.
    const initial = await request(app).get("/api/products");

    expect(initial.status).toBe(200);

    const referenceProduct = (initial.body as ProductsResponse).items[0];

    const searchTerm = referenceProduct.name.trim().slice(0, 3).toUpperCase();

    expect(searchTerm.length).toBeGreaterThan(0);

    const response = await request(app)
      .get("/api/products")
      .query({ q: searchTerm, limit: 50 });

    expect(response.status).toBe(200);

    const body = response.body as ProductsResponse;

    expect(body.items.length).toBeGreaterThan(0);

    for (const product of body.items) {
      expect(product.name.toLowerCase()).toContain(searchTerm.toLowerCase());
    }

    expect(
      body.items.some((product) => product.id === referenceProduct.id),
    ).toBe(true);
  });

  it("sorts products by ascending price", async () => {
    const response = await request(app).get(
      "/api/products?sort=price_asc&limit=50",
    );

    expect(response.status).toBe(200);

    const products = (response.body as ProductsResponse).items;

    expect(products.length).toBeGreaterThan(1);

    for (let i = 1; i < products.length; i++) {
      expect(products[i].price_pawstars).toBeGreaterThanOrEqual(
        products[i - 1].price_pawstars,
      );
    }
  });

  it("sorts products by descending price", async () => {
    const response = await request(app).get(
      "/api/products?sort=price_desc&limit=50",
    );

    expect(response.status).toBe(200);

    const products = (response.body as ProductsResponse).items;

    expect(products.length).toBeGreaterThan(1);

    for (let i = 1; i < products.length; i++) {
      expect(products[i].price_pawstars).toBeLessThanOrEqual(
        products[i - 1].price_pawstars,
      );
    }
  });

  it("returns only active products", async () => {
    // Compare the API response against the database directly.
    // This does not modify any product.
    const dbResult = await pool.query(
      "SELECT COUNT(*)::int AS total FROM products WHERE is_active = TRUE",
    );

    const response = await request(app).get("/api/products?limit=50");

    expect(response.status).toBe(200);

    const body = response.body as ProductsResponse;

    expect(body.total).toBe(dbResult.rows[0].total);

    for (const product of body.items) {
      expect(product.is_active).toBe(true);
    }
  });

  it("returns an individual product by ID", async () => {
    const initial = await request(app).get("/api/products");

    expect(initial.status).toBe(200);

    const referenceProduct = (initial.body as ProductsResponse).items[0];

    const response = await request(app).get(
      `/api/products/${referenceProduct.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(referenceProduct.id);
    expect(response.body.name).toBe(referenceProduct.name);
  });

  it("returns 404 for a nonexistent product", async () => {
    // This is a valid PostgreSQL BIGINT, but it is not a seeded product.
    const response = await request(app).get(
      "/api/products/9223372036854775807",
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects invalid pagination parameters", async () => {
    const response = await request(app).get("/api/products?page=0&limit=5");

    expect(response.status).toBe(400);
  });

  it("rejects unsupported sorting options", async () => {
    const response = await request(app).get("/api/products?sort=invalid_sort");

    expect(response.status).toBe(400);
  });
});
