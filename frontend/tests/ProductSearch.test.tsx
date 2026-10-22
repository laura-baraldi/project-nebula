import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductSearch from "@/components/ProductSearch";
import type { ProductFilters } from "@/lib/productFilters";

// Default catalog state: no category or search selected.
const defaultFilters: ProductFilters = {
  sort: "newest",
  page: 1,
};

/**
 * Render the real search component with the provided filters.
 * The tests inspect its HTML without contacting the Express API.
 */
function renderSearch(filters: ProductFilters = defaultFilters) {
  render(<ProductSearch filters={filters} />);

  return screen.getByRole("search");
}

describe("ProductSearch", () => {
  it("renders an accessible search field and submit button", () => {
    const form = renderSearch();

    expect(
      screen.getByRole("searchbox", { name: "Search products" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute(
      "type",
      "submit",
    );

    expect(form).toHaveAttribute("action", "/products");
    expect(form).toHaveAttribute("method", "GET");
  });

  it("uses q as the search query parameter", () => {
    renderSearch();

    const input = screen.getByRole("searchbox", {
      name: "Search products",
    });

    expect(input).toHaveAttribute("name", "q");
  });

  it("shows the current search query in the input", () => {
    renderSearch({
      ...defaultFilters,
      q: "moon",
    });

    expect(
      screen.getByRole("searchbox", { name: "Search products" }),
    ).toHaveValue("moon");
  });

  it("starts with an empty field when no search exists", () => {
    renderSearch();

    expect(
      screen.getByRole("searchbox", { name: "Search products" }),
    ).toHaveValue("");
  });

  it("allows the user to type a different search", () => {
    renderSearch();

    const input = screen.getByRole("searchbox", {
      name: "Search products",
    });

    fireEvent.change(input, {
      target: { value: "cosmic" },
    });

    expect(input).toHaveValue("cosmic");
  });

  it("limits search input to 100 characters", () => {
    renderSearch();

    expect(
      screen.getByRole("searchbox", { name: "Search products" }),
    ).toHaveAttribute("maxLength", "100");
  });

  it("preserves the selected category using a hidden input", () => {
    const form = renderSearch({
      ...defaultFilters,
      category: "toys",
    });

    const formData = new FormData(form as HTMLFormElement);

    expect(formData.get("category")).toBe("toys");
    expect(formData.get("q")).toBe("");
  });

  it("omits the category parameter when no category is selected", () => {
    const form = renderSearch();
    const formData = new FormData(form as HTMLFormElement);

    expect(formData.has("category")).toBe(false);
  });

  it("preserves non-default sorting when searching", () => {
    const form = renderSearch({
      ...defaultFilters,
      sort: "price_asc",
    });

    const formData = new FormData(form as HTMLFormElement);

    expect(formData.get("sort")).toBe("price_asc");
  });

  it("omits the default sorting parameter", () => {
    const form = renderSearch();
    const formData = new FormData(form as HTMLFormElement);

    expect(formData.has("sort")).toBe(false);
  });

  it("preserves both category and sorting", () => {
    const form = renderSearch({
      category: "clothing",
      q: "moon",
      sort: "price_desc",
      page: 3,
    });

    const formData = new FormData(form as HTMLFormElement);

    expect(formData.get("category")).toBe("clothing");
    expect(formData.get("sort")).toBe("price_desc");
    expect(formData.get("q")).toBe("moon");
  });

  it("resets pagination by omitting the page parameter", () => {
    const form = renderSearch({
      ...defaultFilters,
      page: 3,
    });

    const formData = new FormData(form as HTMLFormElement);

    expect(formData.has("page")).toBe(false);
  });

  it("uses the edited search text when constructing form data", () => {
    const form = renderSearch({
      ...defaultFilters,
      q: "moon",
    });

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search products" }),
      { target: { value: "stars" } },
    );

    const formData = new FormData(form as HTMLFormElement);

    expect(formData.get("q")).toBe("stars");
  });

  it("allows users to clear an existing search", () => {
    const form = renderSearch({
      ...defaultFilters,
      q: "moon",
    });

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search products" }),
      { target: { value: "" } },
    );

    const formData = new FormData(form as HTMLFormElement);

    expect(formData.get("q")).toBe("");
  });
});
