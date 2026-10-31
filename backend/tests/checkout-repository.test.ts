import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, connectMock, releaseMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  connectMock: vi.fn(),
  releaseMock: vi.fn(),
}));

vi.mock("../src/db/pool.js", () => ({
  pool: {
    connect: connectMock,
  },
}));

import { checkout } from "../src/db/checkout/checkout.repository.js";

const cart = [{ id: "cart-1" }];

const product = {
  product_id: "product-1",
  name: "Sphynx Toy",
  price_pawstars: 100,
  quantity: 2,
  stock_quantity: 10,
  is_active: true,
};

const shipping = {
  first_name: "Laura",
  last_name: "Baraldi",
  address_line1: "Via Roma 1",
  address_line2: "Apartment 2",
  city: "Milano",
  postal_code: "20100",
  country: "Italy",
  phone: "+39 123456789",
};

const order = {
  order_number: "ORD-123",
  customer_email: "test@example.com",
  total_pawstars: 200,
  payment_status: "simulated" as const,
  created_at: new Date("2026-10-30T12:00:00.000Z"),
};

function setupCheckout(options?: {
  cartRows?: typeof cart;
  items?: (typeof product)[];
  stockRowCount?: number;
}) {
  const {
    cartRows = cart,
    items = [product],
    stockRowCount = 1,
  } = options ?? {};

  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM carts")) {
      return { rows: cartRows, rowCount: cartRows.length };
    }

    if (sql.includes("FROM cart_items")) {
      return { rows: items, rowCount: items.length };
    }

    if (sql.includes("INSERT INTO orders")) {
      return { rows: [order], rowCount: 1 };
    }

    if (sql.includes("UPDATE products")) {
      return { rows: [], rowCount: stockRowCount };
    }

    return { rows: [], rowCount: 1 };
  });
}

describe("checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    connectMock.mockResolvedValue({
      query: queryMock,
      release: releaseMock,
    });
  });

  it("rejects an invalid email without opening a database connection", async () => {
    await expect(
      checkout("token-hash", "not-an-email", shipping),
    ).rejects.toThrow("Provide a valid email address.");

    expect(connectMock).not.toHaveBeenCalled();
  });

  it("rejects an email longer than 254 characters", async () => {
    const email = `${"a".repeat(245)}@example.com`;

    await expect(checkout("token-hash", email, shipping)).rejects.toThrow(
      "Provide a valid email address.",
    );

    expect(connectMock).not.toHaveBeenCalled();
  });

  it("rejects a missing or expired cart", async () => {
    setupCheckout({ cartRows: [] });

    await expect(
      checkout("token-hash", "test@example.com", shipping),
    ).rejects.toThrow("Cart not found or expired.");

    expect(queryMock).toHaveBeenCalledWith("ROLLBACK");
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("rejects an empty cart", async () => {
    setupCheckout({ items: [] });

    await expect(
      checkout("token-hash", "test@example.com", shipping),
    ).rejects.toThrow("Cannot checkout an empty cart.");

    expect(queryMock).toHaveBeenCalledWith("ROLLBACK");
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("rejects a product that is no longer active", async () => {
    setupCheckout({
      items: [{ ...product, is_active: false }],
    });

    await expect(
      checkout("token-hash", "test@example.com", shipping),
    ).rejects.toThrow("A product in your cart is no longer available.");

    expect(queryMock).toHaveBeenCalledWith("ROLLBACK");
  });

  it("rejects insufficient stock before creating the order", async () => {
    setupCheckout({
      items: [{ ...product, stock_quantity: 1 }],
    });

    await expect(
      checkout("token-hash", "test@example.com", shipping),
    ).rejects.toThrow("There is not enough stock for a product in your cart.");

    expect(
      queryMock.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO orders"),
      ),
    ).toBe(false);
  });

  it("creates an order, saves item snapshots, updates stock and clears the cart", async () => {
    setupCheckout();

    const result = await checkout(
      "token-hash",
      "  test@example.com  ",
      shipping,
    );

    expect(result).toEqual({
      ...order,
      items: [
        {
          product_name: "Sphynx Toy",
          quantity: 2,
          unit_price_pawstars: 100,
          line_total_pawstars: 200,
        },
      ],
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO orders"),
      [
        "test@example.com",
        "Laura",
        "Baraldi",
        "Via Roma 1",
        "Apartment 2",
        "Milano",
        "20100",
        "Italy",
        "+39 123456789",
        200,
      ],
    );

    expect(
      queryMock.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO order_items"),
      ),
    ).toBe(true);

    expect(
      queryMock.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE products"),
      ),
    ).toBe(true);

    expect(queryMock).toHaveBeenCalledWith(
      "DELETE FROM cart_items WHERE cart_id = $1",
      ["cart-1"],
    );

    expect(queryMock).toHaveBeenCalledWith("COMMIT");
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("rolls back if stock changes during checkout", async () => {
    setupCheckout({ stockRowCount: 0 });

    await expect(
      checkout("token-hash", "test@example.com", shipping),
    ).rejects.toThrow("Product stock changed during checkout.");

    expect(queryMock).toHaveBeenCalledWith("ROLLBACK");
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("throws if the order insert returns no order", async () => {
    setupCheckout();

    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM carts")) {
        return { rows: cart, rowCount: 1 };
      }

      if (sql.includes("FROM cart_items")) {
        return { rows: [product], rowCount: 1 };
      }

      if (sql.includes("INSERT INTO orders")) {
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 1 };
    });

    await expect(
      checkout("token-hash", "test@example.com", shipping),
    ).rejects.toThrow("Failed to create order.");

    expect(queryMock).toHaveBeenCalledWith("ROLLBACK");
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("stores null for optional shipping fields when omitted", async () => {
    setupCheckout();

    const { address_line2, phone, ...shippingWithoutOptionalFields } = shipping;

    await checkout(
      "token-hash",
      "test@example.com",
      shippingWithoutOptionalFields,
    );

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO orders"),
      [
        "test@example.com",
        "Laura",
        "Baraldi",
        "Via Roma 1",
        null,
        "Milano",
        "20100",
        "Italy",
        null,
        200,
      ],
    );
  });
});
