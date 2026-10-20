import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProductCard from "@/components/ProductCard";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

const product = {
  name: "Moonwarm Bodysuit",
  description: "A thermal bodysuit for little space explorers.",
  category: "clothing",
  price: 3900,
  imageUrl: "/products/clothing/moonwarm-bodysuit.webp",
};

describe("ProductCard", () => {
  it("renders the product name as a heading", () => {
    render(<ProductCard {...product} />);
    expect(
      screen.getByRole("heading", { name: product.name }),
    ).toBeInTheDocument();
  });

  it("renders the product description", () => {
    render(<ProductCard {...product} />);
    expect(screen.getByText(product.description)).toBeInTheDocument();
  });

  it("renders the product category", () => {
    render(<ProductCard {...product} />);
    expect(screen.getByText("clothing")).toBeInTheDocument();
  });

  it("renders the price in Pawstars", () => {
    render(<ProductCard {...product} />);
    expect(screen.getByText("3900 PWS")).toBeInTheDocument();
  });

  it("renders the correct product image", () => {
    render(<ProductCard {...product} />);
    expect(screen.getByRole("img", { name: product.name })).toHaveAttribute(
      "src",
      product.imageUrl,
    );
  });

  it("renders a different product correctly", () => {
    render(
      <ProductCard
        name="Purrship Mini"
        description="A miniature spacecraft."
        category="travel"
        price={18500}
        imageUrl="/products/travel/purrship-mini.webp"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Purrship Mini" }),
    ).toBeInTheDocument();
    expect(screen.getByText("18500 PWS")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Purrship Mini" })).toHaveAttribute(
      "src",
      "/products/travel/purrship-mini.webp",
    );
  });
});
