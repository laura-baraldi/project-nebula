import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock PostgreSQL so these unit tests never access Neon.
vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

import { pool } from "../src/db/pool.js";
import {
  addCartItem,
  CartBusinessError,
  emptyCart,
  getCartByTokenHash,
} from "../src/db/cart.repository.js";

const mockPoolQuery = vi.mocked(pool.query);
const mockConnect = vi.mocked(pool.connect);

const mockClientQuery = vi.fn();
const mockRelease = vi.fn();

const EXISTING_HASH = "a".repeat(64);
const NEW_HASH = "b".repeat(64);

beforeEach(() => {
  vi.resetAllMocks();

  // Simulate a dedicated connection acquired with pool.connect().
  mockConnect.mockResolvedValue({
    query: mockClientQuery,
    release: mockRelease,
  } as never);

  // Queries without a specific mocked response succeed by default.
  mockClientQuery.mockResolvedValue({ rows: [] });
});

describe("Cart repository - reading carts", () => {
  it("returns an empty cart without database data", () => {
    expect(emptyCart()).toEqual({
      items: [],
      total_pawstars: 0,
    });
  });

  it("returns an empty cart for an unknown or expired token", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

    const result = await getCartByTokenHash(EXISTING_HASH);

    expect(result).toEqual({
      items: [],
      total_pawstars: 0,
    });

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("expires_at > NOW()"),
      [EXISTING_HASH],
    );

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it("calculates current prices, subtotals and availability", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: "10" }],
    } as never);

    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          product_id: "1",
          name: "Moonwarm Bodysuit",
          image_url: null,
          price_pawstars: 3900,
          stock_quantity: 12,
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
        {
          product_id: "3",
          name: "Solar Cape",
          image_url: null,
          price_pawstars: 1000,
          stock_quantity: 10,
          is_active: false,
          quantity: 1,
        },
      ],
    } as never);

    const result = await getCartByTokenHash(EXISTING_HASH);

    expect(result.total_pawstars).toBe(11200);

    expect(result.items.map((item) => item.is_available)).toEqual([
      true,
      false,
      false,
    ]);

    expect(result.items[0].subtotal_pawstars).toBe(7800);
    expect(result.items).toHaveLength(3);

    expect(mockPoolQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("JOIN products"),
      ["10"],
    );
  });

  it("returns an empty cart when an existing cart has no items", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ id: "10" }],
    } as never);

    mockPoolQuery.mockResolvedValueOnce({
      rows: [],
    } as never);

    expect(await getCartByTokenHash(EXISTING_HASH)).toEqual({
      items: [],
      total_pawstars: 0,
    });
  });
});

describe("Cart repository - adding items", () => {
  // Simulate the SQL results for a new cart.
  function mockNewCart(
    product: {
      is_active: boolean;
      stock_quantity: number;
    } | null = { is_active: true, stock_quantity: 10 },
  ) {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: product ? [{ id: "1", ...product }] : [],
      }) // SELECT product FOR UPDATE
      .mockResolvedValueOnce({
        rows: [{ id: "10" }],
      }); // INSERT cart RETURNING id
  }

  // Simulate the SQL results for an existing cart.
  function mockExistingCart(
    currentQuantity: number,
    product: {
      is_active: boolean;
      stock_quantity: number;
    } | null = { is_active: true, stock_quantity: 20 },
  ) {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: "10" }],
      }) // SELECT cart FOR UPDATE
      .mockResolvedValueOnce({
        rows: product ? [{ id: "1", ...product }] : [],
      }) // SELECT product FOR UPDATE
      .mockResolvedValueOnce({
        rows: currentQuantity > 0 ? [{ quantity: currentQuantity }] : [],
      }); // SELECT existing cart item
  }

  it("creates a new cart and commits a successful addition", async () => {
    mockNewCart();

    const result = await addCartItem(null, NEW_HASH, "1", 2);

    expect(result).toEqual({ created: true });
    expect(mockConnect).toHaveBeenCalledOnce();

    expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockClientQuery).not.toHaveBeenCalledWith("ROLLBACK");

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO carts"),
      [NEW_HASH],
    );

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO cart_items"),
      ["10", "1", 2],
    );

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("expires_at = NOW()"),
      ["10"],
    );

    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("adds an existing product by increasing its quantity", async () => {
    mockExistingCart(3);

    const result = await addCartItem(EXISTING_HASH, NEW_HASH, "1", 2);

    expect(result).toEqual({ created: false });

    // Three existing units plus two new units = five.
    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT"),
      ["10", "1", 5],
    );

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE"),
      [EXISTING_HASH],
    );

    expect(
      mockClientQuery.mock.calls.some(
        ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO carts"),
      ),
    ).toBe(false);

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("adds a new product to an existing cart", async () => {
    mockExistingCart(0);

    const result = await addCartItem(EXISTING_HASH, NEW_HASH, "1", 2);

    expect(result.created).toBe(false);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO cart_items"),
      ["10", "1", 2],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("creates a new cart when the old token has no active cart", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // Expired/missing cart
      .mockResolvedValueOnce({
        rows: [
          {
            id: "1",
            is_active: true,
            stock_quantity: 10,
          },
        ],
      }) // Product
      .mockResolvedValueOnce({
        rows: [{ id: "11" }],
      }); // New cart

    const result = await addCartItem(EXISTING_HASH, NEW_HASH, "1", 2);

    expect(result.created).toBe(true);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO carts"),
      [NEW_HASH],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rejects a nonexistent product and rolls back", async () => {
    mockNewCart(null);

    await expect(addCartItem(null, NEW_HASH, "999", 2)).rejects.toMatchObject({
      status: 404,
      code: "PRODUCT_NOT_FOUND",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rejects an inactive product and rolls back", async () => {
    mockNewCart({
      is_active: false,
      stock_quantity: 10,
    });

    await expect(addCartItem(null, NEW_HASH, "1", 2)).rejects.toMatchObject({
      status: 404,
      code: "PRODUCT_NOT_FOUND",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rejects a total quantity greater than 20", async () => {
    mockExistingCart(18);

    await expect(
      addCartItem(EXISTING_HASH, NEW_HASH, "1", 4),
    ).rejects.toMatchObject({
      status: 409,
      code: "QUANTITY_LIMIT_EXCEEDED",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("allows exactly 20 units when stock is sufficient", async () => {
    mockExistingCart(18);

    const result = await addCartItem(EXISTING_HASH, NEW_HASH, "1", 2);

    expect(result.created).toBe(false);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO cart_items"),
      ["10", "1", 20],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("rejects additions exceeding available stock", async () => {
    mockNewCart({
      is_active: true,
      stock_quantity: 1,
    });

    await expect(addCartItem(null, NEW_HASH, "1", 2)).rejects.toMatchObject({
      status: 409,
      code: "INSUFFICIENT_STOCK",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rejects an increase if stock dropped below existing quantity", async () => {
    mockExistingCart(4, {
      is_active: true,
      stock_quantity: 3,
    });

    await expect(
      addCartItem(EXISTING_HASH, NEW_HASH, "1", 1),
    ).rejects.toMatchObject({
      status: 409,
      code: "INSUFFICIENT_STOCK",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rolls back if inserting a cart item fails", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: "1", is_active: true, stock_quantity: 10 }],
      }) // SELECT product
      .mockResolvedValueOnce({
        rows: [{ id: "10" }],
      }) // INSERT cart
      .mockRejectedValueOnce(new Error("Insert failed")); // INSERT item

    await expect(addCartItem(null, NEW_HASH, "1", 2)).rejects.toThrow(
      "Insert failed",
    );

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rolls back if expiration renewal fails", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: "1", is_active: true, stock_quantity: 10 }],
      }) // SELECT product
      .mockResolvedValueOnce({
        rows: [{ id: "10" }],
      }) // INSERT cart
      .mockResolvedValueOnce({ rows: [] }) // INSERT item
      .mockRejectedValueOnce(new Error("Update failed")); // UPDATE cart

    await expect(addCartItem(null, NEW_HASH, "1", 2)).rejects.toThrow(
      "Update failed",
    );

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("releases the client if COMMIT fails", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [{ id: "1", is_active: true, stock_quantity: 10 }],
      }) // SELECT product
      .mockResolvedValueOnce({
        rows: [{ id: "10" }],
      }) // INSERT cart
      .mockResolvedValueOnce({ rows: [] }) // INSERT item
      .mockResolvedValueOnce({ rows: [] }) // UPDATE cart
      .mockRejectedValueOnce(new Error("Commit failed")); // COMMIT

    await expect(addCartItem(null, NEW_HASH, "1", 2)).rejects.toThrow(
      "Commit failed",
    );

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("propagates connection errors", async () => {
    mockConnect.mockRejectedValueOnce(new Error("Connection unavailable"));

    await expect(addCartItem(null, NEW_HASH, "1", 2)).rejects.toThrow(
      "Connection unavailable",
    );

    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("creates the expected business error", () => {
    const error = new CartBusinessError(
      409,
      "INSUFFICIENT_STOCK",
      "Not enough stock available.",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(409);
    expect(error.code).toBe("INSUFFICIENT_STOCK");
    expect(error.message).toBe("Not enough stock available.");
  });
});
