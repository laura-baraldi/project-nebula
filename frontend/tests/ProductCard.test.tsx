import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProductCard from "@/components/ProductCard";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

const product = {
  id: "1",
  name: "Moonwarm Bodysuit",
  description: "A thermal bodysuit for little space explorers.",
  category: "clothing",
  price: 3900,
  imageUrl: "/products/clothing/moonwarm-bodysuit.webp",
  stockQuantity: 5,
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

  it("renders the out-of-stock badge when stock quantity is zero", () => {
    render(<ProductCard {...product} stockQuantity={0} />);

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("does not render the out-of-stock badge when the product is in stock", () => {
    render(<ProductCard {...product} stockQuantity={5} />);

    expect(screen.queryByText("Out of stock")).not.toBeInTheDocument();
  });

  it("renders a different product correctly", () => {
    render(
      <ProductCard
        id="2"
        name="Purrship Mini"
        description="A miniature spacecraft."
        category="travel"
        price={18500}
        imageUrl="/products/travel/purrship-mini.webp"
        stockQuantity={5}
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

  it("links to the correct product detail page", () => {
    render(<ProductCard {...product} />);

    expect(
      screen.getByRole("link", {
        name: "View Moonwarm Bodysuit details",
      }),
    ).toHaveAttribute("href", "/products/1");
  });

  it("uses the product ID instead of the name in the URL", () => {
    render(<ProductCard {...product} id="123" />);

    expect(
      screen.getByRole("link", {
        name: "View Moonwarm Bodysuit details",
      }),
    ).toHaveAttribute("href", "/products/123");
  });
});
