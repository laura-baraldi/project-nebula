import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AddToCartButton from "@/components/AddToCartButton";
import {
  getCart,
  updateCartItem,
  removeCartItem,
  CartApiError,
} from "@/lib/cartApi";

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

// Used only to exercise guards that normal clicks cannot reach,
// such as a disabled button or an invalid quantity.
function invokeReactClickHandler(button: HTMLElement) {
  const reactPropsKey = Object.keys(button).find((key) =>
    key.startsWith("__reactProps$"),
  );

  expect(reactPropsKey).toBeDefined();

  const reactProps = (
    button as unknown as Record<string, { onClick?: () => void }>
  )[reactPropsKey!];

  reactProps.onClick?.();
}

describe("AddToCartButton quantity controls", () => {
  it("loads the existing quantity for this product", async () => {
    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 3 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    render(<AddToCartButton {...props} />);

    expect(
      await screen.findByRole("button", {
        name: "Decrease quantity of Moonwarm Bodysuit",
      }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Quantity: 3")).toHaveTextContent("3");
  });

  it("increases the existing quantity", async () => {
    const user = userEvent.setup();

    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 2 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    vi.mocked(updateCartItem).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 3 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    render(<AddToCartButton {...props} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Increase quantity of Moonwarm Bodysuit",
      }),
    );

    expect(updateCartItem).toHaveBeenCalledWith("12", 3);
    expect(await screen.findByLabelText("Quantity: 3")).toHaveTextContent("3");
  });

  it("removes the product when decreasing quantity from one to zero", async () => {
    const user = userEvent.setup();

    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 1 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    vi.mocked(removeCartItem).mockResolvedValueOnce({
      items: [],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    render(<AddToCartButton {...props} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Decrease quantity of Moonwarm Bodysuit",
      }),
    );

    expect(removeCartItem).toHaveBeenCalledWith("12");

    expect(
      await screen.findByRole("button", { name: "Add to Cart" }),
    ).toBeEnabled();
  });

  it("disables the increase button at the maximum quantity", async () => {
    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 20 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    render(<AddToCartButton {...props} />);

    expect(
      await screen.findByRole("button", {
        name: "Increase quantity of Moonwarm Bodysuit",
      }),
    ).toBeDisabled();
  });

  it("rejects a quantity above 20 even if the handler is invoked directly", async () => {
    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 20 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    render(<AddToCartButton {...props} />);

    const increaseButton = await screen.findByRole("button", {
      name: "Increase quantity of Moonwarm Bodysuit",
    });

    expect(increaseButton).toBeDisabled();

    // Simulates the handler receiving quantity 21.
    invokeReactClickHandler(increaseButton);

    expect(updateCartItem).not.toHaveBeenCalled();
    expect(removeCartItem).not.toHaveBeenCalled();
  });

  it("shows the fallback error when updating quantity fails", async () => {
    const user = userEvent.setup();

    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 2 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    vi.mocked(updateCartItem).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    render(<AddToCartButton {...props} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Increase quantity of Moonwarm Bodysuit",
      }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not update the cart. Please try again.",
    );
  });

  it("shows the backend error when removing a product fails", async () => {
    const user = userEvent.setup();

    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 1 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    vi.mocked(removeCartItem).mockRejectedValueOnce(
      new CartApiError(500, "REMOVE_FAILED", "Could not remove item."),
    );

    render(<AddToCartButton {...props} />);

    await user.click(
      await screen.findByRole("button", {
        name: "Decrease quantity of Moonwarm Bodysuit",
      }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Could not remove item.",
    );
  });

  it("uses compact spacing when the product is already in the cart", async () => {
    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 2 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    const { container } = render(<AddToCartButton {...props} compact />);

    await screen.findByRole("button", {
      name: "Decrease quantity of Moonwarm Bodysuit",
    });

    expect(container.querySelector(".gap-1.p-1")).toBeInTheDocument();
  });

  it("disables quantity controls while an update is loading", async () => {
    const user = userEvent.setup();

    vi.mocked(getCart).mockResolvedValueOnce({
      items: [{ product_id: "12", quantity: 2 }],
      total_pawstars: 0,
    } as Awaited<ReturnType<typeof getCart>>);

    let resolveUpdate!: (
      value: Awaited<ReturnType<typeof updateCartItem>>,
    ) => void;

    vi.mocked(updateCartItem).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<AddToCartButton {...props} />);

    const increaseButton = await screen.findByRole("button", {
      name: "Increase quantity of Moonwarm Bodysuit",
    });

    await user.click(increaseButton);

    expect(increaseButton).toBeDisabled();

    expect(
      screen.getByRole("button", {
        name: "Decrease quantity of Moonwarm Bodysuit",
      }),
    ).toBeDisabled();

    // Bypass the disabled state to verify the loading guard.
    invokeReactClickHandler(increaseButton);

    expect(updateCartItem).toHaveBeenCalledTimes(1);

    resolveUpdate({
      items: [
        {
          product_id: "12",
          quantity: 3,
          name: "Moonwarm Bodysuit",
          image_url: "",
          price_pawstars: 100,
          subtotal_pawstars: 300,
          is_available: true,
        },
      ],
      total_pawstars: 300,
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Increase quantity of Moonwarm Bodysuit",
        }),
      ).toBeEnabled();
    });
  });
});
