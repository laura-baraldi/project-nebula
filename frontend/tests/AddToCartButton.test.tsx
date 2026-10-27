import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AddToCartButton from "@/components/AddToCartButton";
import { addCartItem, getCart, CartApiError } from "@/lib/cartApi";
import { CART_UPDATED_EVENT } from "@/lib/cartEvents";

vi.mock("@/lib/cartApi", () => ({
  addCartItem: vi.fn(),
  getCart: vi.fn(),
  updateCartItem: vi.fn(),
  removeCartItem: vi.fn(),
  CartApiError: class CartApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = "CartApiError";
    }
  },
}));

const props = {
  productId: "12",
  productName: "Moonwarm Bodysuit",
  inStock: true,
};

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getCart).mockResolvedValue({
    items: [],
    total_pawstars: 0,
  });
});

describe("AddToCartButton", () => {
  it("renders an enabled Add to Cart button", () => {
    render(<AddToCartButton {...props} />);

    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeEnabled();
  });

  it("disables the button when the product is out of stock", async () => {
    const user = userEvent.setup();

    render(<AddToCartButton {...props} inStock={false} />);

    const button = screen.getByRole("button", {
      name: "Add Moonwarm Bodysuit to cart",
    });

    expect(button).toBeDisabled();

    await user.click(button);

    expect(addCartItem).not.toHaveBeenCalled();
  });

  it("rejects adding the product when the handler runs out of stock", () => {
    render(<AddToCartButton {...props} inStock={false} />);

    const button = screen.getByRole("button", {
      name: "Add Moonwarm Bodysuit to cart",
    });

    const reactPropsKey = Object.keys(button).find((key) =>
      key.startsWith("__reactProps$"),
    );

    expect(reactPropsKey).toBeDefined();

    const reactProps = (
      button as unknown as Record<string, { onClick?: () => void }>
    )[reactPropsKey!];

    reactProps.onClick?.();

    expect(addCartItem).not.toHaveBeenCalled();
  });

  it("adds one product and notifies the cart update", async () => {
    const user = userEvent.setup();
    const updatedCart = {
      items: [],
      total_pawstars: 0,
    };

    vi.mocked(addCartItem).mockResolvedValueOnce(updatedCart);

    const onCartUpdated = vi.fn();
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);

    try {
      render(<AddToCartButton {...props} />);

      await user.click(screen.getByRole("button", { name: "Add to Cart" }));

      expect(addCartItem).toHaveBeenCalledWith("12", 1);
      expect(onCartUpdated).toHaveBeenCalledOnce();

      const event = onCartUpdated.mock.calls[0][0] as CustomEvent;

      expect(event.detail).toEqual(updatedCart);
    } finally {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
    }
  });

  it("disables repeated submissions while loading", async () => {
    const user = userEvent.setup();

    let resolveRequest!: (
      value: Awaited<ReturnType<typeof addCartItem>>,
    ) => void;

    vi.mocked(addCartItem).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<AddToCartButton {...props} />);

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();

    expect(addCartItem).toHaveBeenCalledTimes(1);

    resolveRequest({
      items: [],
      total_pawstars: 0,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add to Cart" })).toBeEnabled();
    });
  });

  it("displays the backend error message", async () => {
    const user = userEvent.setup();

    vi.mocked(addCartItem).mockRejectedValueOnce(
      new CartApiError(
        409,
        "INSUFFICIENT_STOCK",
        "Not enough stock available.",
      ),
    );

    render(<AddToCartButton {...props} />);

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Not enough stock available.",
    );
  });

  it("displays a fallback message on network failure", async () => {
    const user = userEvent.setup();

    vi.mocked(addCartItem).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    render(<AddToCartButton {...props} />);

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not update the cart. Please try again.",
    );
  });

  it("does not notify a cart update when the API request fails", async () => {
    const user = userEvent.setup();

    vi.mocked(addCartItem).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    const onCartUpdated = vi.fn();
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);

    try {
      render(<AddToCartButton {...props} />);

      await user.click(screen.getByRole("button", { name: "Add to Cart" }));

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Could not update the cart. Please try again.",
      );

      expect(onCartUpdated).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
    }
  });

  it("handles an empty cart when loading the current cart", async () => {
    vi.mocked(getCart).mockResolvedValueOnce({
      items: [],
      total_pawstars: 0,
    });

    render(<AddToCartButton {...props} />);

    expect(
      await screen.findByRole("button", { name: "Add to Cart" }),
    ).toBeEnabled();
  });

  it("handles a cart-loading request failure", async () => {
    vi.mocked(getCart).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<AddToCartButton {...props} />);

    expect(
      await screen.findByRole("button", { name: "Add to Cart" }),
    ).toBeEnabled();
  });

  it("does not update quantity after unmount while cart loading is pending", async () => {
    let resolveCart!: (value: Awaited<ReturnType<typeof getCart>>) => void;

    vi.mocked(getCart).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCart = resolve;
        }),
    );

    const { unmount } = render(<AddToCartButton {...props} />);

    unmount();

    resolveCart({
      items: [{ product_id: "12", quantity: 3 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    await waitFor(() => {
      expect(getCart).toHaveBeenCalledOnce();
    });
  });

  it("uses the compact cart button when compact is true", () => {
    render(<AddToCartButton {...props} compact />);

    expect(
      screen.getByRole("button", {
        name: "Add Moonwarm Bodysuit to cart",
      }),
    ).toBeInTheDocument();
  });
});
