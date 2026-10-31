import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CheckoutPage from "@/app/checkout/page";
import { getCart, type Cart } from "@/lib/cartApi";
import { notifyCartUpdated } from "@/lib/cartEvents";
import {
  checkout,
  CheckoutApiError,
  type CheckoutOrder,
} from "@/lib/checkoutApi";

vi.mock("@/lib/cartApi", () => ({
  getCart: vi.fn(),
}));

vi.mock("@/lib/cartEvents", () => ({
  notifyCartUpdated: vi.fn(),
}));

vi.mock("@/lib/checkoutApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/checkoutApi")>();

  return {
    ...actual,
    checkout: vi.fn(),
  };
});

const mockedGetCart = vi.mocked(getCart);
const mockedCheckout = vi.mocked(checkout);
const mockedNotifyCartUpdated = vi.mocked(notifyCartUpdated);

const emptyCart: Cart = {
  items: [],
  total_pawstars: 0,
};

const filledCart: Cart = {
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
  ],
  total_pawstars: 15800,
};

const mockOrder: CheckoutOrder = {
  order_number: "ORD-123",
  customer_email: "test@example.com",
  total_pawstars: 15800,
  payment_status: "simulated",
  created_at: "2026-10-30T10:00:00.000Z",
  items: [
    {
      product_name: "Comet Stroller",
      quantity: 2,
      unit_price_pawstars: 7900,
      line_total_pawstars: 15800,
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CheckoutPage", () => {
  it("shows a loading state while the cart is loading", () => {
    mockedGetCart.mockReturnValue(new Promise<Cart>(() => {}));

    render(<CheckoutPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading checkout...");
  });

  it("loads and displays the cart and checkout form", async () => {
    mockedGetCart.mockResolvedValue(filledCart);

    render(<CheckoutPage />);

    expect(
      await screen.findByRole("heading", { name: "Checkout" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Comet Stroller × 2")).toBeInTheDocument();
    expect(screen.getAllByText("15800 PWS")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Place order" }),
    ).toBeInTheDocument();
  });

  it("shows an error when loading the cart fails", async () => {
    mockedGetCart.mockRejectedValue(new Error("Network error"));

    render(<CheckoutPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your cart. Please try again.",
    );

    expect(screen.getByRole("link", { name: "Back to cart" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });

  it("shows an empty-cart message when the cart has no items", async () => {
    mockedGetCart.mockResolvedValue(emptyCart);

    render(<CheckoutPage />);

    expect(
      await screen.findByRole("heading", { name: "Your cart is empty" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Explore products" }),
    ).toHaveAttribute("href", "/products");

    expect(
      screen.queryByRole("button", { name: "Place order" }),
    ).not.toBeInTheDocument();
  });

  it("submits the email and shipping details", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);
    mockedCheckout.mockResolvedValue(mockOrder);

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });

    await user.type(
      screen.getByLabelText("Email address *"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("First name *"), "Alex");
    await user.type(screen.getByLabelText("Last name *"), "Smith");
    await user.type(screen.getByLabelText("Address *"), "123 Demo Street");
    await user.type(screen.getByLabelText("City *"), "Stockholm");
    await user.type(screen.getByLabelText("Postal code *"), "12345");
    await user.type(screen.getByLabelText("Country *"), "Sweden");

    await user.click(screen.getByRole("button", { name: "Place order" }));

    await waitFor(() => {
      expect(mockedCheckout).toHaveBeenCalledWith("test@example.com", {
        first_name: "Alex",
        last_name: "Smith",
        address_line1: "123 Demo Street",
        address_line2: "",
        city: "Stockholm",
        postal_code: "12345",
        country: "Sweden",
        phone: "",
      });
    });
  });

  it("shows the order confirmation and notifies that the cart is empty", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);
    mockedCheckout.mockResolvedValue(mockOrder);

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });

    await user.type(
      screen.getByLabelText("Email address *"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("First name *"), "Alex");
    await user.type(screen.getByLabelText("Last name *"), "Smith");
    await user.type(screen.getByLabelText("Address *"), "123 Demo Street");
    await user.type(screen.getByLabelText("City *"), "Stockholm");
    await user.type(screen.getByLabelText("Postal code *"), "12345");
    await user.type(screen.getByLabelText("Country *"), "Sweden");

    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(
      await screen.findByRole("heading", { name: "Order confirmed!" }),
    ).toBeInTheDocument();

    expect(screen.getByText("ORD-123")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();

    expect(mockedNotifyCartUpdated).toHaveBeenCalledWith(emptyCart);
  });

  it("shows the API error when checkout fails", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);
    mockedCheckout.mockRejectedValue(
      new CheckoutApiError(
        409,
        "INSUFFICIENT_STOCK",
        "Not enough stock available.",
      ),
    );

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });

    await user.type(
      screen.getByLabelText("Email address *"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("First name *"), "Alex");
    await user.type(screen.getByLabelText("Last name *"), "Smith");
    await user.type(screen.getByLabelText("Address *"), "123 Demo Street");
    await user.type(screen.getByLabelText("City *"), "Stockholm");
    await user.type(screen.getByLabelText("Postal code *"), "12345");
    await user.type(screen.getByLabelText("Country *"), "Sweden");

    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Not enough stock available.",
    );

    expect(
      screen.queryByRole("heading", { name: "Order confirmed!" }),
    ).not.toBeInTheDocument();

    expect(mockedNotifyCartUpdated).not.toHaveBeenCalled();
  });

  it("shows a generic error for unexpected failures", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);
    mockedCheckout.mockRejectedValue(new Error("Unexpected error"));

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });

    await user.type(
      screen.getByLabelText("Email address *"),
      "test@example.com",
    );
    await user.type(screen.getByLabelText("First name *"), "Alex");
    await user.type(screen.getByLabelText("Last name *"), "Smith");
    await user.type(screen.getByLabelText("Address *"), "123 Demo Street");
    await user.type(screen.getByLabelText("City *"), "Stockholm");
    await user.type(screen.getByLabelText("Postal code *"), "12345");
    await user.type(screen.getByLabelText("Country *"), "Sweden");

    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("disables the submit button and ignores a second submission while checkout is pending", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);
    mockedCheckout.mockReturnValue(new Promise<CheckoutOrder>(() => {}));

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });

    await user.type(
      screen.getByLabelText("Email address *"),
      "demo@example.com",
    );
    await user.type(screen.getByLabelText("First name *"), "Alex");
    await user.type(screen.getByLabelText("Last name *"), "Smith");
    await user.type(screen.getByLabelText("Address *"), "123 Demo Street");
    await user.type(screen.getByLabelText("City *"), "Stockholm");
    await user.type(screen.getByLabelText("Postal code *"), "12345");
    await user.type(screen.getByLabelText("Country *"), "Sweden");

    const form = screen
      .getByRole("button", { name: "Place order" })
      .closest("form");

    expect(form).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Place order" }));

    expect(
      await screen.findByRole("button", { name: "Creating order..." }),
    ).toBeDisabled();

    fireEvent.submit(form!);

    expect(mockedCheckout).toHaveBeenCalledTimes(1);
  });
});
