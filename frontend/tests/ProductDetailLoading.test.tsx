import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductDetailLoading from "@/app/products/[id]/loading";

describe("ProductDetailLoading", () => {
  it("renders an accessible loading status", () => {
    render(<ProductDetailLoading />);

    expect(
      screen.getByRole("status", {
        name: "Loading product details",
      }),
    ).toBeInTheDocument();
  });

  it("provides loading text for screen readers", () => {
    render(<ProductDetailLoading />);

    expect(screen.getByText("Loading product details...")).toHaveClass(
      "sr-only",
    );
  });

  it("renders a square product image placeholder", () => {
    const { container } = render(<ProductDetailLoading />);

    expect(container.querySelector(".aspect-square")).toHaveClass(
      "animate-pulse",
    );
  });

  it("matches the responsive detail layout", () => {
    const { container } = render(<ProductDetailLoading />);

    expect(
      container.querySelector(
        ".lg\\:grid-cols-\\[minmax\\(0\\,1\\.15fr\\)_minmax\\(0\\,0\\.85fr\\)\\]",
      ),
    ).toBeInTheDocument();
  });

  it("hides decorative placeholders from screen readers", () => {
    const { container } = render(<ProductDetailLoading />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it("uses animated loading placeholders", () => {
    const { container } = render(<ProductDetailLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });
});
