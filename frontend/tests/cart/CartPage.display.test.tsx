import { createElement } from "react";
import { render, screen } from "@testing-library/react";
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
  describe("cart contents", () => {
    it("displays product names, prices and subtotals", async () => {
      mockLoadedCart();

      render(<CartPage />);

      expect(await screen.findByText("Comet Stroller")).toBeInTheDocument();
      expect(screen.getByText("Cosmo Carrier Pod")).toBeInTheDocument();

      expect(screen.getByText("7900 PWS each")).toBeInTheDocument();
      expect(screen.getByText("6800 PWS each")).toBeInTheDocument();

      expect(screen.getByText("Subtotal: 15800 PWS")).toBeInTheDocument();
      expect(screen.getByText("Subtotal: 6800 PWS")).toBeInTheDocument();
    });

    it("shows the total returned by the backend", async () => {
      mockLoadedCart();

      render(<CartPage />);

      await screen.findByText("Comet Stroller");

      expect(screen.getByText("22600 PWS")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Cart Summary" }),
      ).toBeInTheDocument();
    });

    it("links products to their detail pages", async () => {
      mockLoadedCart();

      render(<CartPage />);

      expect(
        await screen.findByRole("link", { name: "Comet Stroller" }),
      ).toHaveAttribute("href", "/products/12");

      expect(
        screen.getByRole("link", { name: "Cosmo Carrier Pod" }),
      ).toHaveAttribute("href", "/products/15");
    });

    it("displays product images", async () => {
      mockLoadedCart();

      render(<CartPage />);

      expect(
        await screen.findByRole("img", { name: "Comet Stroller" }),
      ).toHaveAttribute("src", stroller.image_url);
    });

    it("shows a placeholder for a product without an image", async () => {
      mockLoadedCart({
        items: [{ ...stroller, image_url: null }],
        total_pawstars: 15800,
      });

      render(<CartPage />);

      expect(await screen.findByText("No image available")).toBeInTheDocument();

      expect(
        screen.queryByRole("img", { name: "Comet Stroller" }),
      ).not.toBeInTheDocument();
    });

    it("shows an unavailable warning and disables quantity increase", async () => {
      mockLoadedCart({
        items: [{ ...stroller, is_available: false }],
        total_pawstars: 15800,
      });

      render(<CartPage />);

      expect(
        await screen.findByText(/Currently unavailable/i),
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: "Increase Comet Stroller quantity",
        }),
      ).toBeDisabled();

      expect(
        screen.getByRole("button", {
          name: "Decrease Comet Stroller quantity",
        }),
      ).toBeEnabled();
    });

    it("provides a link back to the catalog", () => {
      mockedGetCart.mockReturnValue(new Promise<Cart>(() => {}));

      render(<CartPage />);

      expect(
        screen.getByRole("link", { name: /Continue shopping/i }),
      ).toHaveAttribute("href", "/products");
    });

    it("shows a disabled checkout button", async () => {
      mockLoadedCart();

      render(<CartPage />);

      await screen.findByText("Comet Stroller");

      expect(
        screen.getByRole("button", { name: "Proceed to Checkout" }),
      ).toBeDisabled();
    });
  });
});
