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

async function fillShippingDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email address *"), "test@example.com");
  await user.type(screen.getByLabelText("First name *"), "Alex");
  await user.type(screen.getByLabelText("Last name *"), "Smith");
  await user.type(screen.getByLabelText("Address *"), "123 Demo Street");
  await user.type(screen.getByLabelText("City *"), "Stockholm");
  await user.type(screen.getByLabelText("Postal code *"), "12345");
  await user.type(screen.getByLabelText("Country *"), "Sweden");
}

async function continueToPayment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continue to payment" }));

  expect(
    await screen.findByRole("heading", { name: "Payment method" }),
  ).toBeInTheDocument();
}

async function completePayment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Pay now" }));
}

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
      screen.getByRole("button", { name: "Continue to payment" }),
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
      screen.queryByRole("button", { name: "Continue to payment" }),
    ).not.toBeInTheDocument();
  });

  it("continues to payment without creating an order", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });
    await fillShippingDetails(user);
    await continueToPayment(user);

    expect(screen.getByText("•••• •••• •••• 4242")).toBeInTheDocument();
    expect(screen.getByText("DEMO CUSTOMER")).toBeInTheDocument();
    expect(screen.getByText("12/30")).toBeInTheDocument();

    expect(mockedCheckout).not.toHaveBeenCalled();
  });

  it("returns to shipping and preserves the entered details", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });
    await fillShippingDetails(user);
    await continueToPayment(user);

    await user.click(screen.getByRole("button", { name: "Back to shipping" }));

    expect(
      await screen.findByRole("button", { name: "Continue to payment" }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Email address *")).toHaveValue(
      "test@example.com",
    );
    expect(screen.getByLabelText("First name *")).toHaveValue("Alex");
    expect(screen.getByLabelText("Last name *")).toHaveValue("Smith");
  });

  it("submits the email and shipping details when Pay now is clicked", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);
    mockedCheckout.mockResolvedValue(mockOrder);

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });
    await fillShippingDetails(user);
    await continueToPayment(user);

    expect(mockedCheckout).not.toHaveBeenCalled();

    await completePayment(user);

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
    await fillShippingDetails(user);
    await continueToPayment(user);
    await completePayment(user);

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
    await fillShippingDetails(user);
    await continueToPayment(user);
    await completePayment(user);

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
    await fillShippingDetails(user);
    await continueToPayment(user);
    await completePayment(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("disables Pay now while checkout is pending and calls checkout only once", async () => {
    const user = userEvent.setup();

    mockedGetCart.mockResolvedValue(filledCart);
    mockedCheckout.mockReturnValue(new Promise<CheckoutOrder>(() => {}));

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });
    await fillShippingDetails(user);
    await continueToPayment(user);

    await user.click(screen.getByRole("button", { name: "Pay now" }));

    const processingButton = await screen.findByRole("button", {
      name: "Processing...",
    });

    expect(processingButton).toBeDisabled();

    await user.click(processingButton);

    expect(mockedCheckout).toHaveBeenCalledTimes(1);
    expect(mockedNotifyCartUpdated).not.toHaveBeenCalled();
  });

  it("shows the fallback message when the cart is null without an error", async () => {
    mockedGetCart.mockResolvedValue(null as unknown as Cart);

    render(<CheckoutPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your cart.",
    );
  });

  it("does not continue if the cart becomes empty before submission", async () => {
    let cartIsEmpty = false;

    const items = new Proxy([...filledCart.items], {
      get(target, property, receiver) {
        if (property === "length" && cartIsEmpty) return 0;
        return Reflect.get(target, property, receiver);
      },
    });

    mockedGetCart.mockResolvedValue({ ...filledCart, items } as Cart);

    render(<CheckoutPage />);
    await screen.findByRole("heading", { name: "Checkout" });

    cartIsEmpty = true;

    fireEvent.submit(
      screen
        .getByRole("button", { name: "Continue to payment" })
        .closest("form")!,
    );

    expect(
      screen.queryByRole("heading", { name: "Payment method" }),
    ).not.toBeInTheDocument();
    expect(mockedCheckout).not.toHaveBeenCalled();
  });

  it("does not call checkout if the cart becomes empty before paying", async () => {
    const user = userEvent.setup();
    let cartIsEmpty = false;

    const items = new Proxy([...filledCart.items], {
      get(target, property, receiver) {
        if (property === "length" && cartIsEmpty) return 0;
        return Reflect.get(target, property, receiver);
      },
    });

    mockedGetCart.mockResolvedValue({ ...filledCart, items } as Cart);

    render(<CheckoutPage />);

    await screen.findByRole("heading", { name: "Checkout" });
    await fillShippingDetails(user);
    await continueToPayment(user);

    cartIsEmpty = true;

    await completePayment(user);

    expect(mockedCheckout).not.toHaveBeenCalled();
    expect(mockedNotifyCartUpdated).not.toHaveBeenCalled();
  });

  it("shows the shipping error message when error is set", async () => {
    const unusualResponse = {
      then(onFulfilled: (cart: Cart) => void) {
        onFulfilled(filledCart);
        return Promise.reject(new Error("Network error"));
      },
    };

    mockedGetCart.mockReturnValue(unusualResponse as unknown as Promise<Cart>);

    render(<CheckoutPage />);

    expect(
      await screen.findByRole("heading", { name: "Checkout" }),
    ).toBeInTheDocument();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load your cart. Please try again.",
    );
  });
});
