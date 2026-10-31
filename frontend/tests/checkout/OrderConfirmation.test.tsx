import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OrderConfirmation from "@/components/checkout/OrderConfirmation";
import type { CheckoutOrder } from "@/lib/checkoutApi";

const order: CheckoutOrder = {
  order_number: "ORD-00000123",
  customer_email: "test@example.com",
  total_pawstars: 18300,
  payment_status: "simulated",
  created_at: "2026-10-30T10:00:00.000Z",
  items: [
    {
      product_name: "Comet Stroller",
      quantity: 2,
      unit_price_pawstars: 7900,
      line_total_pawstars: 15800,
    },
    {
      product_name: "Moon Blanket",
      quantity: 1,
      unit_price_pawstars: 2500,
      line_total_pawstars: 2500,
    },
  ],
};

describe("OrderConfirmation", () => {
  it("renders the order confirmation heading and message", () => {
    render(<OrderConfirmation order={order} />);

    expect(
      screen.getByRole("heading", { name: "Order confirmed!" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Thank you! Your order has been created successfully."),
    ).toBeInTheDocument();
  });

  it("displays the order number and confirmation email", () => {
    render(<OrderConfirmation order={order} />);

    expect(screen.getByText("ORD-00000123")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders all ordered items with quantities and line totals", () => {
    render(<OrderConfirmation order={order} />);

    expect(screen.getByText("Comet Stroller × 2")).toBeInTheDocument();
    expect(screen.getByText("Moon Blanket × 1")).toBeInTheDocument();
    expect(screen.getByText("15800 PWS")).toBeInTheDocument();
    expect(screen.getByText("2500 PWS")).toBeInTheDocument();
  });

  it("displays the order total", () => {
    render(<OrderConfirmation order={order} />);

    expect(screen.getByText("18300 PWS")).toBeInTheDocument();
  });

  it("explains that payment is simulated", () => {
    render(<OrderConfirmation order={order} />);

    expect(
      screen.getByText("Payment is simulated. No real payment has been made."),
    ).toBeInTheDocument();
  });

  it("provides a link to continue shopping", () => {
    render(<OrderConfirmation order={order} />);

    expect(
      screen.getByRole("link", { name: "Continue shopping" }),
    ).toHaveAttribute("href", "/products");
  });

  it("renders an order with no items", () => {
    render(
      <OrderConfirmation
        order={{
          ...order,
          items: [],
          total_pawstars: 0,
        }}
      />,
    );

    expect(screen.getByText("ORD-00000123")).toBeInTheDocument();
    expect(screen.getByText("0 PWS")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
