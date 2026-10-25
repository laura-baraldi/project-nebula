import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock PostgreSQL: these tests never connect to Neon.
vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

import { pool } from "../src/db/pool.js";
import { removeCartItem } from "../src/db/cart.repository.js";

const mockConnect = vi.mocked(pool.connect);
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();

const TOKEN_HASH = "a".repeat(64);
const CART_ID = "10";
const PRODUCT_ID = "5";

beforeEach(() => {
  vi.resetAllMocks();

  mockConnect.mockResolvedValue({
    query: mockClientQuery,
    release: mockRelease,
  } as never);

  // Default response for statements without a specific mock.
  mockClientQuery.mockResolvedValue({ rows: [] });
});

// Prepare the responses for a successful deletion:
// BEGIN -> SELECT cart -> DELETE item -> UPDATE cart -> COMMIT.
function mockSuccessfulDelete() {
  mockClientQuery
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ id: CART_ID }] })
    .mockResolvedValueOnce({ rows: [{ id: "99" }] });
}

describe("DELETE cart repository - removeCartItem", () => {
  it("deletes only the requested item and commits", async () => {
    mockSuccessfulDelete();

    await expect(
      removeCartItem(TOKEN_HASH, PRODUCT_ID),
    ).resolves.toBeUndefined();

    expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM cart_items"),
      [CART_ID, PRODUCT_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
    expect(mockClientQuery).not.toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("locks only a valid, non-expired cart", async () => {
    mockSuccessfulDelete();

    await removeCartItem(TOKEN_HASH, PRODUCT_ID);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("expires_at > NOW()"),
      [TOKEN_HASH],
    );

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE"),
      [TOKEN_HASH],
    );
  });

  it("renews expiration after successful deletion", async () => {
    mockSuccessfulDelete();

    await removeCartItem(TOKEN_HASH, PRODUCT_ID);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("expires_at = NOW() + INTERVAL '7 days'"),
      [CART_ID],
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("uses DELETE RETURNING to verify the item existed", async () => {
    mockSuccessfulDelete();

    await removeCartItem(TOKEN_HASH, PRODUCT_ID);

    expect(mockClientQuery).toHaveBeenCalledWith(
      expect.stringContaining("RETURNING id"),
      [CART_ID, PRODUCT_ID],
    );
  });

  it("does not check stock when removing an item", async () => {
    mockSuccessfulDelete();

    await removeCartItem(TOKEN_HASH, PRODUCT_ID);

    const sqlStatements = mockClientQuery.mock.calls.map(([sql]) =>
      String(sql).trim().toUpperCase(),
    );

    // Removing unavailable products must remain possible.
    expect(sqlStatements.some((sql) => sql.includes("FROM PRODUCTS"))).toBe(
      false,
    );

    expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
  });

  it("rejects an unknown or expired cart", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(removeCartItem(TOKEN_HASH, PRODUCT_ID)).rejects.toMatchObject({
      status: 404,
      code: "CART_NOT_FOUND",
      message: "Cart not found.",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rejects a product that is not in the cart", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: CART_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(removeCartItem(TOKEN_HASH, PRODUCT_ID)).rejects.toMatchObject({
      status: 404,
      code: "CART_ITEM_NOT_FOUND",
      message: "Product not found in cart.",
    });

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rolls back if DELETE fails", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: CART_ID }] })
      .mockRejectedValueOnce(new Error("DELETE failed"));

    await expect(removeCartItem(TOKEN_HASH, PRODUCT_ID)).rejects.toThrow(
      "DELETE failed",
    );

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rolls back if expiration renewal fails", async () => {
    mockSuccessfulDelete();

    // After BEGIN, SELECT and DELETE, the next query is UPDATE.
    mockClientQuery.mockRejectedValueOnce(
      new Error("Expiration update failed"),
    );

    await expect(removeCartItem(TOKEN_HASH, PRODUCT_ID)).rejects.toThrow(
      "Expiration update failed",
    );

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClientQuery).not.toHaveBeenCalledWith("COMMIT");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("rolls back if COMMIT fails", async () => {
    mockSuccessfulDelete();

    mockClientQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
    mockClientQuery.mockRejectedValueOnce(new Error("COMMIT failed"));

    await expect(removeCartItem(TOKEN_HASH, PRODUCT_ID)).rejects.toThrow(
      "COMMIT failed",
    );

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("releases the connection when BEGIN fails", async () => {
    mockClientQuery.mockRejectedValueOnce(new Error("BEGIN failed"));

    await expect(removeCartItem(TOKEN_HASH, PRODUCT_ID)).rejects.toThrow(
      "BEGIN failed",
    );

    expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it("propagates errors when acquiring a connection", async () => {
    mockConnect.mockRejectedValueOnce(new Error("Connection unavailable"));

    await expect(removeCartItem(TOKEN_HASH, PRODUCT_ID)).rejects.toThrow(
      "Connection unavailable",
    );

    expect(mockClientQuery).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("always releases the connection after a successful operation", async () => {
    mockSuccessfulDelete();

    await removeCartItem(TOKEN_HASH, PRODUCT_ID);

    expect(mockRelease).toHaveBeenCalledOnce();
    expect(mockClientQuery).toHaveBeenCalledTimes(5);
  });
});
