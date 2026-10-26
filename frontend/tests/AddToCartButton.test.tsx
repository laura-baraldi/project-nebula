import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AddToCartButton from "@/components/AddToCartButton";
import { addCartItem, CartApiError } from "@/lib/cartApi";
import { CART_UPDATED_EVENT } from "@/lib/cartEvents";

vi.mock("@/lib/cartApi", () => ({
  addCartItem: vi.fn(),
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

const mockedAddCartItem = vi.mocked(addCartItem);

const props = {
  productId: "12",
  productName: "Moonwarm Bodysuit",
  inStock: true,
};

beforeEach(() => {
  vi.clearAllMocks();
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
      name: "Out of stock",
    });

    expect(button).toBeDisabled();

    await user.click(button);

    expect(mockedAddCartItem).not.toHaveBeenCalled();
  });

  it("adds one product, notifies the cart update and displays success", async () => {
    const user = userEvent.setup();

    const updatedCart = {
      items: [],
      total_pawstars: 0,
    };

    mockedAddCartItem.mockResolvedValueOnce(updatedCart);

    const onCartUpdated = vi.fn();
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);

    try {
      render(<AddToCartButton {...props} />);

      await user.click(screen.getByRole("button", { name: "Add to Cart" }));

      expect(mockedAddCartItem).toHaveBeenCalledWith("12", 1);

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Moonwarm Bodysuit added to cart!",
      );

      expect(onCartUpdated).toHaveBeenCalledOnce();

      const event = onCartUpdated.mock.calls[0][0] as CustomEvent;

      expect(event.detail).toEqual(updatedCart);
    } finally {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
    }
  });

  it("disables repeated submissions while loading", async () => {
    const user = userEvent.setup();

    let resolveRequest!: (value: { items: []; total_pawstars: number }) => void;

    mockedAddCartItem.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<AddToCartButton {...props} />);

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();

    expect(mockedAddCartItem).toHaveBeenCalledTimes(1);

    resolveRequest({ items: [], total_pawstars: 0 });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add to Cart" })).toBeEnabled();
    });
  });

  it("displays the backend error message", async () => {
    const user = userEvent.setup();

    mockedAddCartItem.mockRejectedValueOnce(
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

    mockedAddCartItem.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<AddToCartButton {...props} />);

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not add the product. Please try again.",
    );
  });

  it("stops the handler when loading is already true", async () => {
    const user = userEvent.setup();

    let resolveRequest!: (value: { items: []; total_pawstars: number }) => void;

    mockedAddCartItem.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<AddToCartButton {...props} />);

    await user.click(screen.getByRole("button", { name: "Add to Cart" }));

    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();

    // Invoke the React click handler directly, bypassing
    // the browser's disabled-button behavior.
    const button = screen.getByRole("button", { name: "Adding..." });

    const reactPropsKey = Object.keys(button).find((key) =>
      key.startsWith("__reactProps$"),
    );

    expect(reactPropsKey).toBeDefined();

    const reactProps = (
      button as unknown as Record<
        string,
        {
          onClick?: () => void;
        }
      >
    )[reactPropsKey!];

    reactProps.onClick?.();

    // The guard must prevent a second API request.
    expect(mockedAddCartItem).toHaveBeenCalledTimes(1);

    resolveRequest({ items: [], total_pawstars: 0 });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add to Cart" })).toBeEnabled();
    });
  });

  it("does not notify a cart update when the API request fails", async () => {
    const user = userEvent.setup();

    mockedAddCartItem.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const onCartUpdated = vi.fn();
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);

    try {
      render(<AddToCartButton {...props} />);

      await user.click(screen.getByRole("button", { name: "Add to Cart" }));

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Could not add the product. Please try again.",
      );

      expect(onCartUpdated).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
    }
  });
});
