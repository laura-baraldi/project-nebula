import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CartPage from "@/app/cart/page";
import { getCart, type Cart } from "@/lib/cartApi";

// Mock API calls but preserve the real CartApiError class.
vi.mock("@/lib/cartApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cartApi")>();

  return {
    ...actual,
    getCart: vi.fn(),
    updateCartItem: vi.fn(),
    removeCartItem: vi.fn(),
  };
});

// Avoid Next.js image optimization in component tests.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

const mockedGetCart = vi.mocked(getCart);

const emptyCart: Cart = {
  items: [],
  total_pawstars: 0,
};

const stroller = {
  product_id: "12",
  name: "Comet Stroller",
  image_url: "/products/travel/comet-stroller.webp",
  price_pawstars: 7900,
  quantity: 2,
  subtotal_pawstars: 15800,
  is_available: true,
};

const carrier = {
  product_id: "15",
  name: "Cosmo Carrier Pod",
  image_url: "/products/travel/cosmo-carrier.webp",
  price_pawstars: 6800,
  quantity: 1,
  subtotal_pawstars: 6800,
  is_available: true,
};

const filledCart: Cart = {
  items: [stroller, carrier],
  total_pawstars: 22600,
};

function mockLoadedCart(cart: Cart = filledCart) {
  mockedGetCart.mockResolvedValue(cart);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CartPage", () => {
  describe("initial loading", () => {
    it("loads the cart when the page mounts", async () => {
      mockLoadedCart();

      render(<CartPage />);

      await screen.findByText("Comet Stroller");

      expect(mockedGetCart).toHaveBeenCalledTimes(1);
    });

    it("shows a loading message while GET is pending", () => {
      mockedGetCart.mockReturnValue(new Promise<Cart>(() => {}));

      render(<CartPage />);

      expect(screen.getByRole("status")).toHaveTextContent(
        "Loading your cart...",
      );
    });

    it("shows an empty cart message when there are no items", async () => {
      mockLoadedCart(emptyCart);

      render(<CartPage />);

      expect(
        await screen.findByRole("heading", {
          name: "Your cart is empty",
        }),
      ).toBeInTheDocument();

      expect(
        screen.getByRole("link", { name: "Explore products" }),
      ).toHaveAttribute("href", "/products");
    });

    it("shows an error and a retry button when GET fails", async () => {
      mockedGetCart.mockRejectedValue(new Error("Network unavailable"));

      render(<CartPage />);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not load your cart. Please try again.",
      );

      expect(
        screen.getByRole("button", { name: "Try again" }),
      ).toBeInTheDocument();

      expect(screen.queryByText("Comet Stroller")).not.toBeInTheDocument();
    });

    it("reloads the cart when the user clicks Try again", async () => {
      const user = userEvent.setup();

      mockedGetCart
        .mockRejectedValueOnce(new Error("Network unavailable"))
        .mockResolvedValueOnce(filledCart);

      render(<CartPage />);

      await user.click(
        await screen.findByRole("button", { name: "Try again" }),
      );

      expect(await screen.findByText("Comet Stroller")).toBeInTheDocument();

      expect(mockedGetCart).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("shows an error when retry also fails", async () => {
    const user = userEvent.setup();

    mockedGetCart
      .mockRejectedValueOnce(new Error("First request failed"))
      .mockRejectedValueOnce(new Error("Retry failed"));

    render(<CartPage />);

    // The first request fails.
    const retryButton = await screen.findByRole("button", {
      name: "Try again",
    });

    // Retry the request.
    await user.click(retryButton);

    // The second request fails too.
    await waitFor(() => {
      expect(mockedGetCart).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load your cart. Please try again.",
      );
    });
  });
});
