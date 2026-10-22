import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductPagination from "@/components/ProductPagination";
import type { ProductFilters } from "@/lib/productFilters";

const defaultFilters: ProductFilters = {
  sort: "newest",
  page: 1,
};

function renderPagination(
  page: number,
  totalPages: number,
  filters: ProductFilters = defaultFilters,
) {
  render(
    <ProductPagination filters={filters} page={page} totalPages={totalPages} />,
  );
}

describe("ProductPagination", () => {
  it("does not render pagination when there is only one page", () => {
    renderPagination(1, 1);

    expect(
      screen.queryByRole("navigation", {
        name: "Product pagination",
      }),
    ).not.toBeInTheDocument();
  });

  it("does not render pagination when there are no pages", () => {
    renderPagination(1, 0);

    expect(
      screen.queryByRole("navigation", {
        name: "Product pagination",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows the current page and total pages", () => {
    renderPagination(2, 5);

    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();
  });

  it("disables Previous on the first page", () => {
    renderPagination(1, 3);

    expect(screen.getByText("Previous")).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    expect(
      screen.queryByRole("link", { name: "Previous" }),
    ).not.toBeInTheDocument();
  });

  it("disables Next on the last page", () => {
    renderPagination(3, 3);

    expect(screen.getByText("Next")).toHaveAttribute("aria-disabled", "true");

    expect(
      screen.queryByRole("link", { name: "Next" }),
    ).not.toBeInTheDocument();
  });

  it("links to the next page", () => {
    renderPagination(1, 3);

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/products?page=2",
    );
  });

  it("links to the previous page", () => {
    renderPagination(3, 3);

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/products?page=2",
    );
  });

  it("enables both links on an intermediate page", () => {
    renderPagination(2, 4);

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/products?page=1",
    );

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/products?page=3",
    );
  });

  it("preserves the selected category", () => {
    renderPagination(1, 3, {
      ...defaultFilters,
      category: "toys",
    });

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/products?category=toys&page=2",
    );
  });

  it("preserves the search query", () => {
    renderPagination(1, 3, {
      ...defaultFilters,
      q: "moon",
    });

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/products?q=moon&page=2",
    );
  });

  it("preserves non-default sorting", () => {
    renderPagination(1, 3, {
      ...defaultFilters,
      sort: "price_desc",
    });

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/products?sort=price_desc&page=2",
    );
  });

  it("preserves category, search and sorting together", () => {
    renderPagination(2, 5, {
      category: "tech",
      q: "moon",
      sort: "price_asc",
      page: 2,
    });

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/products?category=tech&q=moon&sort=price_asc&page=3",
    );

    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/products?category=tech&q=moon&sort=price_asc&page=1",
    );
  });

  it("encodes special characters in the search query", () => {
    renderPagination(1, 3, {
      ...defaultFilters,
      q: "moon & stars",
    });

    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/products?q=moon+%26+stars&page=2",
    );
  });
});
