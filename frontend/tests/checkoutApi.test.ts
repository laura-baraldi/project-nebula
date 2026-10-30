import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkout,
  CheckoutApiError,
  type CheckoutOrder,
} from "../lib/checkoutApi";

const mockFetch = vi.fn();

const mockOrder: CheckoutOrder = {
  order_number: "ORD-123",
  customer_email: "test@example.com",
  total_pawstars: 250,
  payment_status: "simulated",
  created_at: "2026-10-30T10:00:00.000Z",
  items: [
    {
      product_name: "Cat Toy",
      quantity: 2,
      unit_price_pawstars: 125,
      line_total_pawstars: 250,
    },
  ],
};

function mockSuccess(order: CheckoutOrder = mockOrder) {
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ order }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Checkout API client", () => {
  it("POST creates an order and returns it", async () => {
    mockSuccess();

    const order = await checkout("test@example.com");

    expect(order).toEqual(mockOrder);
  });

  it("POST sends the customer email and includes credentials", async () => {
    mockSuccess();

    await checkout("test@example.com");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/cart\/checkout$/),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_email: "test@example.com",
        }),
      }),
    );
  });

  it("preserves error status, code and message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "INSUFFICIENT_STOCK",
            message: "Not enough stock available.",
          },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(checkout("test@example.com")).rejects.toMatchObject({
      name: "CheckoutApiError",
      status: 409,
      code: "INSUFFICIENT_STOCK",
      message: "Not enough stock available.",
    });
  });

  it("handles server errors without a JSON body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Server unavailable", {
        status: 500,
      }),
    );

    await expect(checkout("test@example.com")).rejects.toMatchObject({
      name: "CheckoutApiError",
      status: 500,
      code: "UNKNOWN_ERROR",
      message: "Checkout failed.",
    });
  });

  it("uses fallback error details when JSON has no error fields", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(checkout("test@example.com")).rejects.toMatchObject({
      name: "CheckoutApiError",
      status: 500,
      code: "UNKNOWN_ERROR",
      message: "Checkout failed.",
    });
  });
});
