import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductSort from "@/components/ProductSort";
import type { ProductFilters } from "@/lib/productFilters";

const defaultFilters: ProductFilters = {
  sort: "newest",
  page: 1,
};

function renderSort(filters: ProductFilters = defaultFilters) {
  render(<ProductSort filters={filters} />);

  return screen.getByRole("form", {
    name: "Sort products",
  }) as HTMLFormElement;
}

describe("ProductSort", () => {
  it("renders a GET form targeting the products page", () => {
    const form = renderSort();

    expect(form).toHaveAttribute("action", "/products");
    expect(form).toHaveAttribute("method", "GET");
  });

  it("renders an accessible sorting dropdown", () => {
    renderSort();

    expect(
      screen.getByRole("combobox", { name: "Sort by" }),
    ).toBeInTheDocument();
  });

  it("provides all four sorting options", () => {
    renderSort();

    const options = screen.getAllByRole("option");

    expect(options).toHaveLength(4);

    expect(options[0]).toHaveValue("newest");
    expect(options[1]).toHaveValue("price_asc");
    expect(options[2]).toHaveValue("price_desc");
    expect(options[3]).toHaveValue("name_asc");
  });

  it("selects newest by default", () => {
    renderSort();

    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue(
      "newest",
    );
  });

  it("displays the sorting option selected in the URL", () => {
    renderSort({
      ...defaultFilters,
      sort: "price_desc",
    });

    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue(
      "price_desc",
    );
  });

  it("allows users to change sorting", () => {
    renderSort();

    const select = screen.getByRole("combobox", {
      name: "Sort by",
    });

    fireEvent.change(select, {
      target: { value: "price_asc" },
    });

    expect(select).toHaveValue("price_asc");
  });

  it("submits the selected sorting option", () => {
    const form = renderSort();

    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "name_asc" },
    });

    const formData = new FormData(form);

    expect(formData.get("sort")).toBe("name_asc");
  });

  it("preserves the selected category", () => {
    const form = renderSort({
      ...defaultFilters,
      category: "toys",
    });

    const formData = new FormData(form);

    expect(formData.get("category")).toBe("toys");
  });

  it("omits category when no category is selected", () => {
    const form = renderSort();

    const formData = new FormData(form);

    expect(formData.has("category")).toBe(false);
  });

  it("preserves the active search query", () => {
    const form = renderSort({
      ...defaultFilters,
      q: "moon",
    });

    const formData = new FormData(form);

    expect(formData.get("q")).toBe("moon");
  });

  it("omits an empty search query", () => {
    const form = renderSort();

    const formData = new FormData(form);

    expect(formData.has("q")).toBe(false);
  });

  it("preserves category and search together", () => {
    const form = renderSort({
      category: "tech",
      q: "galaxy",
      sort: "price_desc",
      page: 3,
    });

    const formData = new FormData(form);

    expect(formData.get("category")).toBe("tech");
    expect(formData.get("q")).toBe("galaxy");
    expect(formData.get("sort")).toBe("price_desc");
  });

  it("resets pagination by omitting the page parameter", () => {
    const form = renderSort({
      ...defaultFilters,
      page: 4,
    });

    const formData = new FormData(form);

    expect(formData.has("page")).toBe(false);
  });

  it("provides an Apply button to submit the form", () => {
    renderSort();

    expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
