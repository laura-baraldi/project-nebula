import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CategoryFilters from "@/components/CategoryFilters";
import { PRODUCT_CATEGORIES, type ProductFilters } from "@/lib/productFilters";

// Default state: no category or search selected.
const defaultFilters: ProductFilters = {
  sort: "newest",
  page: 1,
};

/**
 * Render the category filters using the provided catalog state.
 *
 * Both desktop and mobile navigations exist in the DOM.
 * Tailwind CSS determines which version is visible on screen.
 */
function renderFilters(filters: ProductFilters = defaultFilters) {
  render(<CategoryFilters filters={filters} />);

  const navigations = screen.getAllByRole("navigation", {
    name: "Product categories",
    hidden: true,
  });

  return navigations;
}

describe("CategoryFilters", () => {
  it("renders a category navigation for desktop and mobile", () => {
    const navigations = renderFilters();

    expect(navigations).toHaveLength(2);
  });

  it("renders all eight categories in both navigations", () => {
    const navigations = renderFilters();

    for (const navigation of navigations) {
      const links = within(navigation).getAllByRole("link");

      // Eight database categories plus the All Products link.
      expect(links).toHaveLength(PRODUCT_CATEGORIES.length + 1);

      expect(
        within(navigation).getByRole("link", { name: "All Products" }),
      ).toBeInTheDocument();

      for (const name of [
        "Clothing",
        "Home",
        "Skincare",
        "Technology",
        "Toys",
        "Food",
        "Accessories",
        "Travel",
      ]) {
        expect(
          within(navigation).getByRole("link", { name }),
        ).toBeInTheDocument();
      }
    }
  });

  it("marks All Products as active when no category is selected", () => {
    const navigations = renderFilters();

    for (const navigation of navigations) {
      expect(
        within(navigation).getByRole("link", { name: "All Products" }),
      ).toHaveAttribute("aria-current", "page");

      expect(
        within(navigation).getByRole("link", { name: "Toys" }),
      ).not.toHaveAttribute("aria-current");
    }
  });

  it("marks only the selected category as active", () => {
    const navigations = renderFilters({
      ...defaultFilters,
      category: "toys",
    });

    for (const navigation of navigations) {
      expect(
        within(navigation).getByRole("link", { name: "Toys" }),
      ).toHaveAttribute("aria-current", "page");

      expect(
        within(navigation).getByRole("link", { name: "All Products" }),
      ).not.toHaveAttribute("aria-current");

      expect(
        within(navigation).getByRole("link", { name: "Clothing" }),
      ).not.toHaveAttribute("aria-current");
    }
  });

  it("uses the correct API category value in the URL", () => {
    const navigations = renderFilters();

    for (const navigation of navigations) {
      expect(
        within(navigation).getByRole("link", { name: "Technology" }),
      ).toHaveAttribute("href", "/products?category=tech");
    }
  });

  it("links All Products to the unfiltered catalog", () => {
    const navigations = renderFilters({
      ...defaultFilters,
      category: "clothing",
    });

    for (const navigation of navigations) {
      expect(
        within(navigation).getByRole("link", { name: "All Products" }),
      ).toHaveAttribute("href", "/products");
    }
  });

  it("preserves the current search query when changing category", () => {
    const navigations = renderFilters({
      ...defaultFilters,
      q: "moon",
    });

    for (const navigation of navigations) {
      expect(
        within(navigation).getByRole("link", { name: "Toys" }),
      ).toHaveAttribute("href", "/products?category=toys&q=moon");
    }
  });

  it("preserves sorting when changing category", () => {
    const navigations = renderFilters({
      ...defaultFilters,
      sort: "price_asc",
    });

    for (const navigation of navigations) {
      expect(
        within(navigation).getByRole("link", { name: "Food" }),
      ).toHaveAttribute("href", "/products?category=food&sort=price_asc");
    }
  });

  it("preserves both search and sorting when clearing category", () => {
    const navigations = renderFilters({
      category: "clothing",
      q: "moon & stars",
      sort: "price_desc",
      page: 2,
    });

    for (const navigation of navigations) {
      expect(
        within(navigation).getByRole("link", { name: "All Products" }),
      ).toHaveAttribute("href", "/products?q=moon+%26+stars&sort=price_desc");
    }
  });

  it("resets pagination when switching categories", () => {
    const navigations = renderFilters({
      category: "clothing",
      sort: "newest",
      page: 3,
    });

    for (const navigation of navigations) {
      const toysLink = within(navigation).getByRole("link", {
        name: "Toys",
      });

      expect(toysLink).toHaveAttribute("href", "/products?category=toys");
      expect(toysLink.getAttribute("href")).not.toContain("page=");
    }
  });

  it("renders the mobile filters menu", () => {
    renderFilters();

    const details = document.querySelector("details");

    expect(details).toBeInTheDocument();
    expect(details).toHaveClass("lg:hidden");

    expect(within(details!).getByText("Filters")).toBeInTheDocument();
  });

  it("renders the desktop sidebar", () => {
    renderFilters();

    const sidebar = document.querySelector("aside");

    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass("hidden", "lg:block");

    expect(
      within(sidebar!).getByRole("heading", { name: "Categories" }),
    ).toBeInTheDocument();
  });

  it("shows the selected category in the mobile filter summary", () => {
    render(
      <CategoryFilters
        filters={{ category: "tech", sort: "newest", page: 1 }}
      />,
    );

    const summary = screen.getByText("Filters").closest("summary");

    expect(summary).toHaveTextContent("Technology");
  });

  it("shows only Filters when no category is selected", () => {
    render(<CategoryFilters filters={{ sort: "newest", page: 1 }} />);

    const summary = screen.getByText("Filters").closest("summary");

    expect(summary).toHaveTextContent("Filters");
    expect(summary).not.toHaveTextContent("Technology");
  });
});
