import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import ProductsPage, { ProductsContent } from "@/app/products/page";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

const products = [
  {
    id: "1",
    name: "Moonwarm Bodysuit",
    description: "A thermal bodysuit for little space explorers.",
    category: "clothing",
    price_pawstars: 3900,
    image_url: "/products/clothing/moonwarm-bodysuit.webp",
  },
  {
    id: "2",
    name: "Purrship Mini",
    description: "A miniature spacecraft.",
    category: "travel",
    price_pawstars: 18500,
    image_url: "/products/travel/purrship-mini.webp",
  },
];

function mockApiResponse(items = products, total = items.length) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items,
      page: 1,
      limit: 30,
      total,
      totalPages: 1,
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductsContent", () => {
  it("requests the catalog from the Express API", async () => {
    const fetchMock = mockApiResponse();
    await ProductsContent();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?limit=30",
      { cache: "no-store" },
    );
  });

  it("renders the page heading", async () => {
    mockApiResponse();
    render(await ProductsContent());
    expect(
      screen.getByRole("heading", { name: "Explore the Galaxy" }),
    ).toBeInTheDocument();
  });

  it("displays the total number of available products", async () => {
    mockApiResponse(products, 30);
    render(await ProductsContent());
    expect(screen.getByText("30 products available")).toBeInTheDocument();
  });

  it("renders all products returned by the API", async () => {
    mockApiResponse();
    render(await ProductsContent());
    expect(
      screen.getByRole("heading", { name: "Moonwarm Bodysuit" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Purrship Mini" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("passes prices and image paths to product cards", async () => {
    mockApiResponse();
    render(await ProductsContent());
    expect(screen.getByText("3900 PWS")).toBeInTheDocument();
    expect(screen.getByText("18500 PWS")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Purrship Mini" })).toHaveAttribute(
      "src",
      "/products/travel/purrship-mini.webp",
    );
  });

  it("handles an empty product catalog", async () => {
    mockApiResponse([], 0);
    render(await ProductsContent());
    expect(screen.getByText("0 products available")).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("throws an error when the API returns an unsuccessful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(ProductsContent()).rejects.toThrow("Failed to load products");
  });

  it("propagates network errors when the API cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network unavailable")),
    );
    await expect(ProductsContent()).rejects.toThrow("Network unavailable");
  });
});

// Test the page wrapper without rendering the async Server Component.
describe("ProductsPage", () => {
  it("wraps ProductsContent in Suspense", () => {
    const element = ProductsPage();

    expect(element.type).toBe(Suspense);
    expect(element.props.children.type).toBe(ProductsContent);
  });

  it("provides a loading fallback", () => {
    const element = ProductsPage();

    render(element.props.fallback);

    expect(screen.getByText("Loading products...")).toBeInTheDocument();
  });
});
