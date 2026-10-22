import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductEmptyState from "@/components/ProductEmptyState";

describe("ProductEmptyState", () => {
  it("shows the no-results message", () => {
    render(<ProductEmptyState isPageOutOfRange={false} />);

    expect(
      screen.getByRole("heading", { name: "No products found" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/couldn't find any products matching/i),
    ).toBeInTheDocument();
  });

  it("shows the out-of-range message", () => {
    render(<ProductEmptyState isPageOutOfRange={true} />);

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/there are no products on this page/i),
    ).toBeInTheDocument();
  });

  it("renders an accessible status message", () => {
    render(<ProductEmptyState isPageOutOfRange={false} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("provides a link back to the full catalog", () => {
    render(<ProductEmptyState isPageOutOfRange={false} />);

    expect(
      screen.getByRole("link", { name: "View all products" }),
    ).toHaveAttribute("href", "/products");
  });

  it("also provides a catalog link for out-of-range pages", () => {
    render(<ProductEmptyState isPageOutOfRange={true} />);

    expect(
      screen.getByRole("link", { name: "View all products" }),
    ).toHaveAttribute("href", "/products");
  });

  it("hides the decorative icon from assistive technologies", () => {
    const { container } = render(
      <ProductEmptyState isPageOutOfRange={false} />,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "🔭",
    );
  });

  it("uses a different decorative icon for out-of-range pages", () => {
    const { container } = render(<ProductEmptyState isPageOutOfRange={true} />);

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "🪐",
    );
  });
});
