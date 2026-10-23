import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductNotFound from "@/app/products/[id]/not-found";

describe("ProductNotFound", () => {
  it("renders the not-found heading", () => {
    render(<ProductNotFound />);

    expect(
      screen.getByRole("heading", { name: "Product not found" }),
    ).toBeInTheDocument();
  });

  it("explains why the product is unavailable", () => {
    render(<ProductNotFound />);

    expect(screen.getByText(/may no longer be available/i)).toBeInTheDocument();
  });

  it("provides a link back to the catalog", () => {
    render(<ProductNotFound />);

    expect(
      screen.getByRole("link", { name: "Back to products" }),
    ).toHaveAttribute("href", "/products");
  });
});
