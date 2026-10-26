import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CartLink from "@/components/CartLink";
import { getCart, type Cart } from "@/lib/cartApi";
import { notifyCartUpdated } from "@/lib/cartEvents";

vi.mock("@/lib/cartApi", () => ({
  getCart: vi.fn(),
}));

const mockedGetCart = vi.mocked(getCart);

const filledCart: Cart = {
  items: [
    {
      product_id: "12",
      name: "Comet Stroller",
      image_url: null,
      price_pawstars: 7900,
      quantity: 2,
      subtotal_pawstars: 15800,
      is_available: true,
    },
    {
      product_id: "15",
      name: "Cosmo Carrier Pod",
      image_url: null,
      price_pawstars: 6800,
      quantity: 1,
      subtotal_pawstars: 6800,
      is_available: true,
    },
  ],
  total_pawstars: 22600,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CartLink", () => {
  it("links to the cart page", async () => {
    mockedGetCart.mockResolvedValue(filledCart);

    render(<CartLink />);

    expect(
      screen.getByRole("link", { name: "View shopping cart" }),
    ).toHaveAttribute("href", "/cart");

    expect(screen.getByText("Cart")).toBeInTheDocument();

    await screen.findByText("3");
  });

  it("shows the total quantity of items", async () => {
    mockedGetCart.mockResolvedValue(filledCart);

    render(<CartLink />);

    expect(await screen.findByText("3")).toBeInTheDocument();

    expect(screen.getByLabelText("3 items in cart")).toBeInTheDocument();
  });

  it("updates the count when the cart changes", async () => {
    mockedGetCart.mockResolvedValue(filledCart);

    render(<CartLink />);

    expect(await screen.findByText("3")).toBeInTheDocument();

    const updatedCart: Cart = {
      ...filledCart,
      items: [
        {
          ...filledCart.items[0],
          quantity: 4,
          subtotal_pawstars: 31600,
        },
      ],
      total_pawstars: 31600,
    };

    act(() => {
      notifyCartUpdated(updatedCart);
    });

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("hides the badge when the cart becomes empty", async () => {
    mockedGetCart.mockResolvedValue(filledCart);

    render(<CartLink />);

    expect(await screen.findByText("3")).toBeInTheDocument();

    act(() => {
      notifyCartUpdated({
        items: [],
        total_pawstars: 0,
      });
    });

    expect(screen.queryByLabelText("3 items in cart")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View shopping cart" }),
    ).toBeInTheDocument();
  });

  it("does not overwrite a newer cart update with an older API response", async () => {
    let resolveCart!: (cart: Cart) => void;

    mockedGetCart.mockImplementationOnce(
      () =>
        new Promise<Cart>((resolve) => {
          resolveCart = resolve;
        }),
    );

    render(<CartLink />);

    const updatedCart: Cart = {
      ...filledCart,
      items: [
        {
          ...filledCart.items[0],
          quantity: 5,
          subtotal_pawstars: 39500,
        },
      ],
      total_pawstars: 39500,
    };

    act(() => {
      notifyCartUpdated(updatedCart);
    });

    expect(screen.getByText("5")).toBeInTheDocument();

    await act(async () => {
      resolveCart(filledCart);
    });

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("removes the cart event listener when unmounted", async () => {
    mockedGetCart.mockResolvedValue(filledCart);

    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    try {
      const { unmount } = render(<CartLink />);

      expect(await screen.findByText("3")).toBeInTheDocument();

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "cart:updated",
        expect.any(Function),
      );
    } finally {
      removeEventListenerSpy.mockRestore();
    }
  });

  it("cleans up when CartLink unmounts during loading", async () => {
    let resolveCart!: (cart: Cart) => void;

    mockedGetCart.mockImplementationOnce(
      () =>
        new Promise<Cart>((resolve) => {
          resolveCart = resolve;
        }),
    );

    const { unmount } = render(<CartLink />);

    // Unmount while getCart is still pending.
    unmount();

    // The pending request resolves after unmounting.
    await act(async () => {
      resolveCart(filledCart);
    });

    // The badge must not reappear in the DOM.
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("keeps the cart count unknown when loading fails", async () => {
    mockedGetCart.mockRejectedValueOnce(new Error("Network error"));

    render(<CartLink />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole("link", { name: "View shopping cart" }),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText(/items in cart/)).not.toBeInTheDocument();
  });
});
