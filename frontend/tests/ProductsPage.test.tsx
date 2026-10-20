import { createElement, Suspense } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProductsPage, { ProductsContent } from "@/app/products/page";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

// Sample products used by the catalog tests.
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

/**
 * Mock the Express products API.
 *
 * The tests can inspect requests and render predictable product
 * data without connecting to the real backend or database.
 */
function mockApiResponse(items = products, total = items.length) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items,
      page: 1,
      limit: 20,
      total,
      totalPages: Math.ceil(total / 20),
    }),
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductsContent", () => {
  it("requests the first 20 products using default filters", async () => {
    const fetchMock = mockApiResponse();

    await ProductsContent();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?sort=newest&page=1&limit=20",
      { cache: "no-store" },
    );
  });

  it("passes the selected category to the Express API", async () => {
    const fetchMock = mockApiResponse();

    await ProductsContent({
      searchParams: Promise.resolve({
        category: "toys",
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?category=toys&sort=newest&page=1&limit=20",
      { cache: "no-store" },
    );
  });

  it("passes a search query to the Express API", async () => {
    const fetchMock = mockApiResponse();

    await ProductsContent({
      searchParams: Promise.resolve({
        q: "moon",
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?q=moon&sort=newest&page=1&limit=20",
      { cache: "no-store" },
    );
  });

  it("passes the selected sorting option to the Express API", async () => {
    const fetchMock = mockApiResponse();

    await ProductsContent({
      searchParams: Promise.resolve({
        sort: "price_desc",
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?sort=price_desc&page=1&limit=20",
      { cache: "no-store" },
    );
  });

  it("requests the selected catalog page", async () => {
    const fetchMock = mockApiResponse();

    await ProductsContent({
      searchParams: Promise.resolve({
        page: "2",
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?sort=newest&page=2&limit=20",
      { cache: "no-store" },
    );
  });

  it("combines category, search, sorting and pagination", async () => {
    const fetchMock = mockApiResponse();

    await ProductsContent({
      searchParams: Promise.resolve({
        category: "toys",
        q: "moon & stars",
        sort: "price_asc",
        page: "2",
      }),
    });

    // URLSearchParams encodes spaces as + and & as %26.
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?category=toys&q=moon+%26+stars&sort=price_asc&page=2&limit=20",
      { cache: "no-store" },
    );
  });

  it("does not forward invalid URL parameters to the backend", async () => {
    const fetchMock = mockApiResponse();

    await ProductsContent({
      searchParams: Promise.resolve({
        category: "dinosaurs",
        sort: "random",
        page: "-5",
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?sort=newest&page=1&limit=20",
      { cache: "no-store" },
    );
  });

  it("does not forward repeated filter values", async () => {
    const fetchMock = mockApiResponse();

    await ProductsContent({
      searchParams: Promise.resolve({
        category: ["toys", "food"],
        q: ["moon", "stars"],
        sort: ["newest", "price_asc"],
        page: ["1", "2"],
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products?sort=newest&page=1&limit=20",
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

  it("displays the total number of matching products", async () => {
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

  it("forwards URL search parameters to ProductsContent", () => {
    const searchParams = Promise.resolve({
      category: "toys",
      page: "2",
    });

    const element = ProductsPage({ searchParams });

    expect(element.props.children.props.searchParams).toBe(searchParams);
  });
});
