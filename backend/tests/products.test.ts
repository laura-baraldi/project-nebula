import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Replace the real database with a mock.
vi.mock("../src/db/pool.js", () => ({
  pool: { query: vi.fn() },
}));

import { pool } from "../src/db/pool.js";
import { app } from "../src/app.js";

const mockQuery = vi.mocked(pool.query);

// Simulate the two database queries used by the product list endpoint.
function mockProductList(
  products: Record<string, unknown>[],
  total = products.length,
) {
  mockQuery.mockResolvedValueOnce({ rows: [{ total }] } as never);
  mockQuery.mockResolvedValueOnce({ rows: products } as never);
}

describe("GET /api/products", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns products with default pagination", async () => {
    const products = [
      { id: "1", name: "Moonwarm Bodysuit" },
      { id: "2", name: "Nebula Blanket" },
    ];

    mockProductList(products);

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: products,
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("calculates pagination and offset correctly", async () => {
    mockProductList([{ id: "3", name: "Space Toy" }], 11);

    const response = await request(app).get("/api/products?page=2&limit=5");

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(2);
    expect(response.body.limit).toBe(5);
    expect(response.body.total).toBe(11);
    expect(response.body.totalPages).toBe(3);
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.any(String), [
      null,
      null,
      null,
      null,
      5,
      5,
    ]);
  });

  it("returns an empty list when no products match", async () => {
    mockProductList([]);

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.total).toBe(0);
    expect(response.body.totalPages).toBe(0);
  });

  it.each([
    "/api/products?page=0",
    "/api/products?page=-1",
    "/api/products?page=abc",
    "/api/products?page=1.5",
    "/api/products?limit=0",
    "/api/products?limit=101",
    "/api/products?limit=abc",
  ])("rejects invalid pagination: %s", async (url) => {
    const response = await request(app).get(url);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_PAGINATION");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects invalid sort options", async () => {
    const response = await request(app).get("/api/products?sort=random");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_SORT");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each([
    ["newest", "created_at DESC, id DESC"],
    ["price_asc", "price_pawstars ASC, id ASC"],
    ["price_desc", "price_pawstars DESC, id DESC"],
    ["name_asc", "name ASC, id ASC"],
  ])("uses the correct SQL ordering for %s", async (sort, orderBy) => {
    mockProductList([]);

    const response = await request(app).get(`/api/products?sort=${sort}`);

    expect(response.status).toBe(200);
    expect(mockQuery.mock.calls[1][0]).toContain(`ORDER BY ${orderBy}`);
  });

  it("applies category and price filters", async () => {
    mockProductList([
      {
        id: "21",
        name: "Moon Mouse Rover",
        category: "toys",
        price_pawstars: 2100,
      },
    ]);

    const response = await request(app).get(
      "/api/products?category=toys&min_price=1000&max_price=3000",
    );

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.any(String), [
      "toys",
      1000,
      3000,
      null,
    ]);
    expect(mockQuery).toHaveBeenNthCalledWith(2, expect.any(String), [
      "toys",
      1000,
      3000,
      null,
      20,
      0,
    ]);
  });

  it("applies case-insensitive name search", async () => {
    mockProductList([{ id: "1", name: "Moonwarm Bodysuit" }]);

    const response = await request(app).get("/api/products?q=MOON");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("ILIKE"),
      [null, null, null, "MOON"],
    );
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ILIKE"),
      [null, null, null, "MOON", 20, 0],
    );
  });

  it("trims whitespace from the search query", async () => {
    mockProductList([]);

    const response = await request(app).get("/api/products?q=%20moon%20");

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.any(String), [
      null,
      null,
      null,
      "moon",
    ]);
  });

  it("treats an empty search as no search filter", async () => {
    mockProductList([]);

    const response = await request(app).get("/api/products?q=%20%20");

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.any(String), [
      null,
      null,
      null,
      null,
    ]);
  });

  it("combines search, category, price, sort and pagination", async () => {
    mockProductList([{ id: "1", name: "Moonwarm Bodysuit" }]);

    const response = await request(app).get(
      "/api/products?q=moon&category=clothing&min_price=1000&max_price=5000&sort=price_asc&page=2&limit=5",
    );

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ORDER BY price_pawstars ASC, id ASC"),
      ["clothing", 1000, 5000, "moon", 5, 5],
    );
  });

  it.each([
    "/api/products?min_price=-1",
    "/api/products?max_price=-1",
    "/api/products?min_price=abc",
    "/api/products?max_price=1.5",
    "/api/products?min_price=3000&max_price=1000",
    "/api/products?min_price=2147483648",
    "/api/products?max_price=2147483648",
  ])("rejects invalid price filters: %s", async (url) => {
    const response = await request(app).get(url);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_PRICE_RANGE");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects repeated category parameters", async () => {
    const response = await request(app).get(
      "/api/products?category=toys&category=food",
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_CATEGORY");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects repeated search parameters", async () => {
    const response = await request(app).get("/api/products?q=moon&q=star");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_SEARCH");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Verify that unknown query parameters are rejected before reaching the database.
  it("rejects unknown query parameters", async () => {
    const response = await request(app).get("/api/products?colore=rosa");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Unknown query parameter: colore",
      },
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns HTTP 500 when the database fails", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Database unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app).get("/api/products");
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("trims whitespace from category", async () => {
    mockProductList([]);

    const response = await request(app).get(
      "/api/products?category=%20toys%20",
    );

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.any(String), [
      "toys",
      null,
      null,
      null,
    ]);
  });

  it("treats an empty category as no filter", async () => {
    mockProductList([]);

    const response = await request(app).get("/api/products?category=%20%20");

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.any(String), [
      null,
      null,
      null,
      null,
    ]);
  });

  it("rejects search queries longer than 100 characters", async () => {
    const longSearch = "a".repeat(101);
    const response = await request(app).get(`/api/products?q=${longSearch}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("GET /api/products/:id", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a single active product", async () => {
    const product = {
      id: "1",
      name: "Moonwarm Bodysuit",
      price_pawstars: 3900,
      is_active: true,
    };
    mockQuery.mockResolvedValueOnce({ rows: [product] } as never);

    const response = await request(app).get("/api/products/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(product);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("id = $1::bigint"),
      ["1"],
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("returns HTTP 404 when the product does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    const response = await request(app).get("/api/products/999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." },
    });
  });

  it.each(["abc", "0", "-1", "1.5", "999999999999999999999999999"])(
    "rejects invalid product ID: %s",
    async (id) => {
      const response = await request(app).get(`/api/products/${id}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_PRODUCT_ID");
      expect(mockQuery).not.toHaveBeenCalled();
    },
  );

  it("preserves large BIGINT IDs without precision loss", async () => {
    const id = "9007199254740993";
    mockQuery.mockResolvedValueOnce({
      rows: [{ id, name: "Rare Space Artifact" }],
    } as never);

    const response = await request(app).get(`/api/products/${id}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(id);
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [id]);
  });

  it("returns HTTP 500 when the database fails", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Database unavailable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await request(app).get("/api/products/1");
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
