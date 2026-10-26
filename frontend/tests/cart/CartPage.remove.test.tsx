import { createElement } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CartPage from "@/app/cart/page";
import {
  getCart,
  updateCartItem,
  removeCartItem,
  CartApiError,
  type Cart,
} from "@/lib/cartApi";

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
const mockedRemoveCartItem = vi.mocked(removeCartItem);

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
  describe("removing items", () => {
    it("removes the selected product", async () => {
      const user = userEvent.setup();

      mockLoadedCart();

      mockedRemoveCartItem.mockResolvedValue({
        items: [carrier],
        total_pawstars: 6800,
      });

      render(<CartPage />);

      await screen.findByText("Comet Stroller");

      const item = screen
        .getByRole("link", {
          name: "Comet Stroller",
        })
        .closest("article");

      expect(item).not.toBeNull();

      await user.click(
        within(item as HTMLElement).getByRole("button", {
          name: "Remove",
        }),
      );

      expect(mockedRemoveCartItem).toHaveBeenCalledWith("12");

      await waitFor(() => {
        expect(screen.queryByText("Comet Stroller")).not.toBeInTheDocument();
      });

      expect(screen.getByText("Cosmo Carrier Pod")).toBeInTheDocument();
      expect(screen.getByText("6800 PWS")).toBeInTheDocument();
    });

    it("shows the empty state after removing the last item", async () => {
      const user = userEvent.setup();

      mockLoadedCart({
        items: [stroller],
        total_pawstars: 15800,
      });

      mockedRemoveCartItem.mockResolvedValue(emptyCart);

      render(<CartPage />);

      await user.click(
        await screen.findByRole("button", {
          name: "Remove",
        }),
      );

      expect(
        await screen.findByRole("heading", {
          name: "Your cart is empty",
        }),
      ).toBeInTheDocument();
    });

    it("disables actions while DELETE is pending", async () => {
      const user = userEvent.setup();
      const pending = deferredCart();

      mockLoadedCart();
      mockedRemoveCartItem.mockReturnValue(pending.promise);

      render(<CartPage />);

      await screen.findByText("Comet Stroller");

      await user.click(
        screen.getAllByRole("button", {
          name: "Remove",
        })[0],
      );

      expect(await screen.findByText("Updating...")).toBeInTheDocument();

      expect(
        screen.getAllByRole("button", { name: "Remove" })[0],
      ).toBeDisabled();

      pending.resolve(filledCart);

      await waitFor(() => {
        expect(screen.queryByText("Updating...")).not.toBeInTheDocument();
      });
    });

    it("shows a backend error when DELETE fails", async () => {
      const user = userEvent.setup();

      mockLoadedCart();

      mockedRemoveCartItem.mockRejectedValue(
        new CartApiError(500, "SERVER_ERROR", "Could not remove item"),
      );

      render(<CartPage />);

      await user.click(
        (await screen.findAllByRole("button", { name: "Remove" }))[0],
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not remove item",
      );

      expect(screen.getByText("Comet Stroller")).toBeInTheDocument();
    });

    it("shows a generic error when DELETE fails unexpectedly", async () => {
      const user = userEvent.setup();

      mockLoadedCart();
      mockedRemoveCartItem.mockRejectedValue(new Error("Network failure"));

      render(<CartPage />);

      await user.click(
        (await screen.findAllByRole("button", { name: "Remove" }))[0],
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not remove the product. Please try again.",
      );
    });
  });

  it("prevents a second quantity update while one is pending", async () => {
    const user = userEvent.setup();
    const pending = deferredCart();

    mockLoadedCart();
    mockedUpdateCartItem.mockReturnValue(pending.promise);

    render(<CartPage />);

    const button = await screen.findByRole("button", {
      name: "Increase Comet Stroller quantity",
    });

    await user.click(button);

    expect(button).toBeDisabled();
    expect(mockedUpdateCartItem).toHaveBeenCalledTimes(1);

    // Invoke the React handler directly to test the defensive guard.
    const propsKey = Object.keys(button).find((key) =>
      key.startsWith("__reactProps$"),
    );

    expect(propsKey).toBeDefined();

    const reactProps = (
      button as unknown as Record<
        string,
        {
          onClick: () => void;
        }
      >
    )[propsKey!];

    reactProps.onClick();

    expect(mockedUpdateCartItem).toHaveBeenCalledTimes(1);

    pending.resolve(filledCart);

    await waitFor(() => {
      expect(button).toBeEnabled();
    });
  });

  it("rejects a quantity below one inside the handler", async () => {
    mockLoadedCart({
      items: [{ ...stroller, quantity: 1, subtotal_pawstars: 7900 }],
      total_pawstars: 7900,
    });

    render(<CartPage />);

    const button = await screen.findByRole("button", {
      name: "Decrease Comet Stroller quantity",
    });

    expect(button).toBeDisabled();

    const propsKey = Object.keys(button).find((key) =>
      key.startsWith("__reactProps$"),
    );

    expect(propsKey).toBeDefined();

    const reactProps = (
      button as unknown as Record<
        string,
        {
          onClick: () => void;
        }
      >
    )[propsKey!];

    reactProps.onClick();

    expect(mockedUpdateCartItem).not.toHaveBeenCalled();
  });

  it("rejects a quantity above twenty inside the handler", async () => {
    mockLoadedCart({
      items: [{ ...stroller, quantity: 20, subtotal_pawstars: 158000 }],
      total_pawstars: 158000,
    });

    render(<CartPage />);

    const button = await screen.findByRole("button", {
      name: "Increase Comet Stroller quantity",
    });

    expect(button).toBeDisabled();

    const propsKey = Object.keys(button).find((key) =>
      key.startsWith("__reactProps$"),
    );

    expect(propsKey).toBeDefined();

    const reactProps = (
      button as unknown as Record<
        string,
        {
          onClick: () => void;
        }
      >
    )[propsKey!];

    reactProps.onClick();

    expect(mockedUpdateCartItem).not.toHaveBeenCalled();
  });

  it("prevents removing another item while an update is pending", async () => {
    const user = userEvent.setup();
    const pending = deferredCart();

    mockLoadedCart();
    mockedUpdateCartItem.mockReturnValue(pending.promise);

    render(<CartPage />);

    // Start an update and keep it pending.
    await user.click(
      await screen.findByRole("button", {
        name: "Increase Comet Stroller quantity",
      }),
    );

    const removeButton = screen.getAllByRole("button", {
      name: "Remove",
    })[1];

    expect(removeButton).toBeDisabled();

    // Bypass the disabled button to test the internal guard.
    const propsKey = Object.keys(removeButton).find((key) =>
      key.startsWith("__reactProps$"),
    );

    expect(propsKey).toBeDefined();

    const reactProps = (
      removeButton as unknown as Record<
        string,
        {
          onClick: () => void;
        }
      >
    )[propsKey!];

    reactProps.onClick();

    // No DELETE request should be made.
    expect(mockedRemoveCartItem).not.toHaveBeenCalled();

    pending.resolve(filledCart);

    await waitFor(() => {
      expect(removeButton).toBeEnabled();
    });
  });


});
