import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProductDetailPage from "@/app/products/[id]/page";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

// Simulate the behavior of Next.js notFound().
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

type Product = {
  id: string;
  name: string;
  description: string;
  price_pawstars: number;
  category: string;
  stock_quantity: number;
  image_url: string | null;
};

const product: Product = {
  id: "12",
  name: "Comet Stroller",
  description:
    "A premium futuristic stroller for royal or exceptionally sleepy little space explorers.",
  price_pawstars: 7900,
  category: "travel",
  stock_quantity: 5,
  image_url: "/products/travel/comet-stroller.webp",
};

// Simulate a successful response from Express.
function mockApiResponse(data = product) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

// Next.js provides route parameters as a Promise.
function pageProps(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductDetailPage", () => {
  it("requests the correct product from Express", async () => {
    const fetchMock = mockApiResponse();

    await ProductDetailPage(pageProps("12"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products/12",
      { cache: "no-store" },
    );
  });

  it("renders the product name", async () => {
    mockApiResponse();

    render(await ProductDetailPage(pageProps("12")));

    expect(
      screen.getByRole("heading", { name: "Comet Stroller" }),
    ).toBeInTheDocument();
  });

  it("renders the product description", async () => {
    mockApiResponse();

    render(await ProductDetailPage(pageProps("12")));

    expect(screen.getByText(product.description)).toBeInTheDocument();
  });

  it("renders the product category", async () => {
    mockApiResponse();

    render(await ProductDetailPage(pageProps("12")));

    expect(screen.getAllByText("travel")).toHaveLength(2);
  });

  it("renders the product price in Pawstars", async () => {
    mockApiResponse();

    render(await ProductDetailPage(pageProps("12")));

    expect(screen.getByText("7900 PWS")).toBeInTheDocument();
  });

  it("renders the correct product image", async () => {
    mockApiResponse();

    render(await ProductDetailPage(pageProps("12")));

    expect(screen.getByRole("img", { name: "Comet Stroller" })).toHaveAttribute(
      "src",
      product.image_url,
    );
  });

  it("shows a placeholder when the product has no image", async () => {
    mockApiResponse({
      ...product,
      image_url: null,
    });

    render(await ProductDetailPage(pageProps("12")));

    expect(screen.getByText("No image available")).toBeInTheDocument();

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows In stock when stock is available", async () => {
    mockApiResponse();

    render(await ProductDetailPage(pageProps("12")));

    expect(screen.getByText("In stock")).toBeInTheDocument();
  });

  it("shows Out of stock when stock is zero", async () => {
    mockApiResponse({
      ...product,
      stock_quantity: 0,
    });

    render(await ProductDetailPage(pageProps("12")));

    expect(screen.getAllByText("Out of stock")).toHaveLength(2);

    expect(
      screen.getByRole("button", { name: "Add Comet Stroller to cart" }),
    ).toBeDisabled();
  });

  it("provides a link back to the product catalog", async () => {
    mockApiResponse();

    render(await ProductDetailPage(pageProps("12")));

    expect(
      screen.getByRole("link", { name: /Back to products/i }),
    ).toHaveAttribute("href", "/products");
  });

  it.each(["0", "-1", "abc", "1.5", "001", "9223372036854775808"])(
    "rejects invalid product ID %s",
    async (id) => {
      const fetchMock = mockApiResponse();

      await expect(ProductDetailPage(pageProps(id))).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );

      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("accepts large valid BIGINT product IDs", async () => {
    const fetchMock = mockApiResponse();

    await ProductDetailPage(pageProps("9223372036854775807"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/products/9223372036854775807",
      { cache: "no-store" },
    );
  });

  it("returns a not-found page for a missing product", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(ProductDetailPage(pageProps("999"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("throws an error when the API returns HTTP 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(ProductDetailPage(pageProps("12"))).rejects.toThrow(
      "Failed to load product details",
    );
  });

  it("propagates network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network unavailable")),
    );

    await expect(ProductDetailPage(pageProps("12"))).rejects.toThrow(
      "Network unavailable",
    );
  });
});
