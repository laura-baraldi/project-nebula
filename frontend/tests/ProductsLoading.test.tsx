import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductsLoading from "@/app/products/loading";

describe("ProductsLoading", () => {
  it("renders the catalog heading", () => {
    render(<ProductsLoading />);

    expect(
      screen.getByRole("heading", { name: "Explore the Galaxy" }),
    ).toBeInTheDocument();
  });

  it("provides an accessible loading status", () => {
    render(<ProductsLoading />);

    expect(
      screen.getByRole("status", { name: "Loading products" }),
    ).toBeInTheDocument();

    expect(screen.getByText("Loading products...")).toHaveClass("sr-only");
  });

  it("renders six product skeleton cards", () => {
    const { container } = render(<ProductsLoading />);

    const cards = container.querySelectorAll(".grid.gap-6 > div");

    expect(cards).toHaveLength(6);
  });

  it("marks decorative placeholders as hidden", () => {
    const { container } = render(<ProductsLoading />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4);
  });

  it("renders animated placeholders", () => {
    const { container } = render(<ProductsLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });
});
