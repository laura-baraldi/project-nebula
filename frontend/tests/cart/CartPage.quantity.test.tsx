import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CartPage from "@/app/cart/page";
import { getCart, updateCartItem, CartApiError, type Cart } from "@/lib/cartApi";

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
const mockedUpdateCartItem = vi.mocked(updateCartItem);

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

// Create a Promise that the test can resolve manually.
function deferredCart() {
  let resolve!: (cart: Cart) => void;
  let reject!: (reason: Error) => void;

  const promise = new Promise<Cart>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CartPage", () => {
  describe("quantity updates", () => {
    it("increases the quantity by one", async () => {
      const user = userEvent.setup();

      mockLoadedCart();

      mockedUpdateCartItem.mockResolvedValue({
        items: [
          {
            ...stroller,
            quantity: 3,
            subtotal_pawstars: 23700,
          },
          carrier,
        ],
        total_pawstars: 30500,
      });

      render(<CartPage />);

      await user.click(
        await screen.findByRole("button", {
          name: "Increase Comet Stroller quantity",
        }),
      );

      expect(mockedUpdateCartItem).toHaveBeenCalledWith("12", 3);

      expect(
        await screen.findByText("Subtotal: 23700 PWS"),
      ).toBeInTheDocument();

      expect(screen.getByText("30500 PWS")).toBeInTheDocument();
    });

    it("decreases the quantity by one", async () => {
      const user = userEvent.setup();

      mockLoadedCart();

      mockedUpdateCartItem.mockResolvedValue({
        items: [
          {
            ...stroller,
            quantity: 1,
            subtotal_pawstars: 7900,
          },
          carrier,
        ],
        total_pawstars: 14700,
      });

      render(<CartPage />);

      await user.click(
        await screen.findByRole("button", {
          name: "Decrease Comet Stroller quantity",
        }),
      );

      expect(mockedUpdateCartItem).toHaveBeenCalledWith("12", 1);

      expect(await screen.findByText("Subtotal: 7900 PWS")).toBeInTheDocument();
    });

    it("disables decrease when quantity is already one", async () => {
      const user = userEvent.setup();

      mockLoadedCart();

      render(<CartPage />);

      const button = await screen.findByRole("button", {
        name: "Decrease Cosmo Carrier Pod quantity",
      });

      expect(button).toBeDisabled();

      await user.click(button);

      expect(mockedUpdateCartItem).not.toHaveBeenCalled();
    });

    it("disables increase when quantity reaches twenty", async () => {
      const user = userEvent.setup();

      mockLoadedCart({
        items: [
          {
            ...stroller,
            quantity: 20,
            subtotal_pawstars: 158000,
          },
        ],
        total_pawstars: 158000,
      });

      render(<CartPage />);

      const button = await screen.findByRole("button", {
        name: "Increase Comet Stroller quantity",
      });

      expect(button).toBeDisabled();

      await user.click(button);

      expect(mockedUpdateCartItem).not.toHaveBeenCalled();
    });

    it("disables cart actions while PATCH is pending", async () => {
      const user = userEvent.setup();
      const pending = deferredCart();

      mockLoadedCart();
      mockedUpdateCartItem.mockReturnValue(pending.promise);

      render(<CartPage />);

      await user.click(
        await screen.findByRole("button", {
          name: "Increase Comet Stroller quantity",
        }),
      );

      expect(await screen.findByText("Updating...")).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: "Increase Comet Stroller quantity",
        }),
      ).toBeDisabled();

      expect(
        screen.getAllByRole("button", { name: "Remove" })[0],
      ).toBeDisabled();

      pending.resolve(filledCart);

      await waitFor(() => {
        expect(screen.queryByText("Updating...")).not.toBeInTheDocument();
      });
    });

    it("shows a backend error when PATCH fails", async () => {
      const user = userEvent.setup();

      mockLoadedCart();

      mockedUpdateCartItem.mockRejectedValue(
        new CartApiError(409, "INSUFFICIENT_STOCK", "Not enough stock"),
      );

      render(<CartPage />);

      await user.click(
        await screen.findByRole("button", {
          name: "Increase Comet Stroller quantity",
        }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not enough stock",
      );

      expect(screen.getByText("Subtotal: 15800 PWS")).toBeInTheDocument();
    });

    it("shows a generic error when PATCH fails unexpectedly", async () => {
      const user = userEvent.setup();

      mockLoadedCart();
      mockedUpdateCartItem.mockRejectedValue(new TypeError("Failed to fetch"));

      render(<CartPage />);

      await user.click(
        await screen.findByRole("button", {
          name: "Increase Comet Stroller quantity",
        }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not update the quantity. Please try again.",
      );
    });
  });

});
