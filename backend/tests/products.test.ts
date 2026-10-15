import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Replace the real database with a mock.
vi.mock("../src/db/pool.js", () => ({
  pool: { query: vi.fn() },
}));

import { pool } from "../src/db/pool.js";
import { app } from "../src/app.js";

const mockQuery = vi.mocked(pool.query);

// Simulate the database queries used by the product list endpoint.
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
    expect(response.body).toMatchObject({
      page: 2,
      limit: 5,
      total: 11,
      totalPages: 3,
    });
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
    expect(response.body).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it.each([
    "/api/products?page=0",
    "/api/products?page=-1",
    "/api/products?page=abc",
    "/api/products?page=1.5",
    "/api/products?page=1e2",
    "/api/products?page=",
    "/api/products?page=9007199254740992",
    "/api/products?limit=0",
    "/api/products?limit=101",
    "/api/products?limit=abc",
    "/api/products?limit=0x10",
    "/api/products?limit=",
    "/api/products?page=9007199254740991&limit=100",
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

  it("treats an empty search as no filter", async () => {
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

  it("accepts a search query of exactly 100 characters", async () => {
    mockProductList([]);
    const search = "a".repeat(100);

    const response = await request(app).get(`/api/products?q=${search}`);

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.any(String), [
      null,
      null,
      null,
      search,
    ]);
  });

  it("rejects search queries longer than 100 characters", async () => {
    const response = await request(app).get(
      `/api/products?q=${"a".repeat(101)}`,
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockQuery).not.toHaveBeenCalled();
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
    "/api/products?min_price=1e2",
    "/api/products?max_price=0x10",
    "/api/products?min_price=",
    "/api/products?max_price=",
  ])("rejects invalid price filters: %s", async (url) => {
    const response = await request(app).get(url);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_PRICE_RANGE");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("accepts the maximum supported price", async () => {
    mockProductList([]);

    const response = await request(app).get(
      "/api/products?max_price=2147483647",
    );

    expect(response.status).toBe(200);
    expect(mockQuery).toHaveBeenNthCalledWith(1, expect.any(String), [
      null,
      null,
      2147483647,
      null,
    ]);
  });

  it.each([
    "/api/products?category=toys&category=food",
    "/api/products?q=moon&q=star",
    "/api/products?page=1&page=2",
    "/api/products?limit=5&limit=10",
    "/api/products?sort=newest&sort=price_asc",
    "/api/products?min_price=100&min_price=200",
    "/api/products?max_price=500&max_price=1000",
  ])("rejects repeated query parameters: %s", async (url) => {
    const response = await request(app).get(url);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mockQuery).not.toHaveBeenCalled();
  });

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
