import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProductsError from "@/app/products/error";

// Mock the Next.js router without performing real navigation.
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

// Mock the transition so retry behavior can be tested synchronously.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    startTransition: (callback: () => void) => callback(),
  };
});

const testError = new Error("Failed to load products");
const resetMock = vi.fn();

function renderError() {
  render(<ProductsError error={testError} reset={resetMock} />);
}

describe("ProductsError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays an accessible error message", () => {
    renderError();

    expect(screen.getByRole("alert")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/couldn't load the products right now/i),
    ).toBeInTheDocument();
  });

  it("provides a Try again button", () => {
    renderError();

    expect(screen.getByRole("button", { name: "Try again" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("refreshes the route and resets the error boundary", () => {
    renderError();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refreshMock).toHaveBeenCalledOnce();
    expect(resetMock).toHaveBeenCalledOnce();
  });

  it("does not show technical error details to users", () => {
    renderError();

    expect(
      screen.queryByText("Failed to load products"),
    ).not.toBeInTheDocument();
  });

  it("hides the decorative icon from assistive technologies", () => {
    const { container } = render(
      <ProductsError error={testError} reset={resetMock} />,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "🛸",
    );
  });
});
