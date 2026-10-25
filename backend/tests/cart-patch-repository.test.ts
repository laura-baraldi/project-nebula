import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database pool: no real PostgreSQL connection.
vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

import { pool } from "../src/db/pool.js";
import {
  CartBusinessError,
  updateCartItemQuantity,
} from "../src/db/cart.repository.js";

const mockConnect = vi.mocked(pool.connect);
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();

const TOKEN_HASH = "a".repeat(64);
const CART_ID = "10";
const PRODUCT_ID = "5";

// Configure database responses for an existing cart and item.
function mockExistingItem(
  existingQuantity = 3,
  product: {
    is_active: boolean;
    stock_quantity: number;
  } | null = {
    is_active: true,
    stock_quantity: 20,
  },
) {
  mockClientQuery
    .mockResolvedValueOnce({ rows: [] }) // BEGIN
    .mockResolvedValueOnce({
      rows: [{ id: CART_ID }],
    }) // SELECT cart
    .mockResolvedValueOnce({
      rows: [{ quantity: existingQuantity }],
    }) // SELECT cart item
    .mockResolvedValueOnce({
      rows: product ? [product] : [],
    }); // SELECT product
}

beforeEach(() => {
  vi.resetAllMocks();

  mockConnect.mockResolvedValue({
    query: mockClientQuery,
    release: mockRelease,
  } as never);

  // Remaining queries succeed unless explicitly overridden.
  mockClientQuery.mockResolvedValue({ rows: [] });
});

describe("PATCH cart repository - updateCartItemQuantity", () => {
  it("replaces the existing quantity instead of adding to it", async () => {
    mockExistingItem(3);

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 5),
    ).resolves.toBeUndefined();

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET quantity = $1"),
      [5, CART_ID, PRODUCT_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("can reduce the quantity", async () => {
    mockExistingItem(5);

    await updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 2);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET quantity = $1"),
      [2, CART_ID, PRODUCT_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("accepts an unchanged quantity", async () => {
    mockExistingItem(3);

    await updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 3);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET quantity = $1"),
      [3, CART_ID, PRODUCT_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("renews the expiration after a successful update", async () => {
    mockExistingItem();

    await updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 2);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("expires_at = NOW() + INTERVAL '7 days'"),
      [CART_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("locks the cart and product during the transaction", async () => {
    mockExistingItem();

    await updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 4);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE"),
      [TOKEN_HASH],
    );

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE"),
      [PRODUCT_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("rejects a missing or expired cart", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // No cart

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 2),
    ).rejects.toMatchObject({
      status: 404,
      code: "CART_NOT_FOUND",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rejects a product that is not in the cart", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: CART_ID }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 2),
    ).rejects.toMatchObject({
      status: 404,
      code: "CART_ITEM_NOT_FOUND",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rejects increasing an inactive product", async () => {
    mockExistingItem(3, {
      is_active: false,
      stock_quantity: 20,
    });

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 4),
    ).rejects.toMatchObject({
      status: 409,
      code: "PRODUCT_UNAVAILABLE",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
  });

  it("rejects increasing a product missing from the catalog", async () => {
    mockExistingItem(3, null);

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 4),
    ).rejects.toMatchObject({
      status: 409,
      code: "PRODUCT_UNAVAILABLE",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
  });

  it("allows reducing an inactive product", async () => {
    mockExistingItem(5, {
      is_active: false,
      stock_quantity: 0,
    });

    await updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 2);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET quantity = $1"),
      [2, CART_ID, PRODUCT_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("allows reducing an unavailable item without increasing stock demand", async () => {
    mockExistingItem(5, {
      is_active: true,
      stock_quantity: 1,
    });

    await updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 2);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET quantity = $1"),
      [2, CART_ID, PRODUCT_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("rejects increases beyond available stock", async () => {
    mockExistingItem(3, {
      is_active: true,
      stock_quantity: 4,
    });

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 5),
    ).rejects.toMatchObject({
      status: 409,
      code: "INSUFFICIENT_STOCK",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
  });

  it("allows increasing to exactly the available stock", async () => {
    mockExistingItem(3, {
      is_active: true,
      stock_quantity: 5,
    });

    await updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 5);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("SET quantity = $1"),
      [5, CART_ID, PRODUCT_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("rolls back when updating the item fails", async () => {
    mockExistingItem(3);

    // After BEGIN, cart SELECT, item SELECT and product SELECT,
    // the next query is the cart_items UPDATE.
    mockClientQuery.mockRejectedValueOnce(
      new Error("Failed to update cart item"),
    );

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 4),
    ).rejects.toThrow("Failed to update cart item");

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rolls back when renewing cart expiration fails", async () => {
    mockExistingItem(3);

    mockClientQuery.mockResolvedValueOnce({ rows: [] }); // Item UPDATE
    mockClientQuery.mockRejectedValueOnce(
      new Error("Failed to renew expiration"),
    );

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 4),
    ).rejects.toThrow("Failed to renew expiration");

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rolls back when COMMIT fails", async () => {
    mockExistingItem(3);

    mockClientQuery.mockResolvedValueOnce({ rows: [] }); // Item UPDATE
    mockClientQuery.mockResolvedValueOnce({ rows: [] }); // Cart UPDATE
    mockClientQuery.mockRejectedValueOnce(new Error("Commit failed"));

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 4),
    ).rejects.toThrow("Commit failed");

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("releases the connection when BEGIN fails", async () => {
    mockClientQuery.mockRejectedValueOnce(new Error("Transaction failed"));

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 2),
    ).rejects.toThrow("Transaction failed");

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("propagates connection errors", async () => {
    mockConnect.mockRejectedValueOnce(new Error("Connection unavailable"));

    await expect(
      updateCartItemQuantity(TOKEN_HASH, PRODUCT_ID, 2),
    ).rejects.toThrow("Connection unavailable");

    expect(mockClientQuery).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("creates CartBusinessError with the correct properties", () => {
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
