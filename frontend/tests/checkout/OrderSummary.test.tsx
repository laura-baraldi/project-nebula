import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OrderSummary from "@/components/checkout/OrderSummary";
import type { Cart } from "@/lib/cartApi";

const cart: Cart = {
  items: [
    {
      product_id: "12",
      name: "Comet Stroller",
      image_url: "/products/travel/comet-stroller.webp",
      price_pawstars: 7900,
      quantity: 2,
      subtotal_pawstars: 15800,
      is_available: true,
    },
    {
      product_id: "13",
      name: "Moon Blanket",
      image_url: "/products/accessories/moon-blanket.webp",
      price_pawstars: 2500,
      quantity: 1,
      subtotal_pawstars: 2500,
      is_available: true,
    },
  ],
  total_pawstars: 18300,
};

describe("OrderSummary", () => {
  it("renders the order summary heading", () => {
    render(<OrderSummary cart={cart} />);

    expect(
      screen.getByRole("heading", { name: "Order summary" }),
    ).toBeInTheDocument();
  });

  it("renders every cart item with its quantity", () => {
    render(<OrderSummary cart={cart} />);

    expect(screen.getByText("Comet Stroller × 2")).toBeInTheDocument();
    expect(screen.getByText("Moon Blanket × 1")).toBeInTheDocument();
  });

  it("renders each item's subtotal", () => {
    render(<OrderSummary cart={cart} />);

    expect(screen.getByText("15800 PWS")).toBeInTheDocument();
    expect(screen.getByText("2500 PWS")).toBeInTheDocument();
  });

  it("renders the cart total", () => {
    render(<OrderSummary cart={cart} />);

    expect(screen.getByText("18300 PWS")).toBeInTheDocument();
  });

  it("renders an empty summary when the cart has no items", () => {
    render(<OrderSummary cart={{ items: [], total_pawstars: 0 }} />);

    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("0 PWS")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
