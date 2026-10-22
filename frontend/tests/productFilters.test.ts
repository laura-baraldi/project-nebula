import { describe, expect, it } from "vitest";

import {
  buildProductQuery,
  parseProductFilters,
  PRODUCTS_PER_PAGE,
} from "@/lib/productFilters";

describe("parseProductFilters", () => {
  it("uses default values when no parameters are provided", () => {
    const filters = parseProductFilters({});

    expect(filters).toEqual({
      sort: "newest",
      page: 1,
    });
  });

  it("accepts valid category, search, sorting and pagination", () => {
    const filters = parseProductFilters({
      category: "toys",
      q: "moon",
      sort: "price_asc",
      page: "2",
    });

    expect(filters).toEqual({
      category: "toys",
      q: "moon",
      sort: "price_asc",
      page: 2,
    });
  });

  it("ignores unsupported categories and sorting options", () => {
    const filters = parseProductFilters({
      category: "dinosaurs",
      sort: "random",
    });

    expect(filters).toEqual({
      sort: "newest",
      page: 1,
    });
  });

  it.each(["0", "-1", "abc", "1.5", "9007199254740992"])(
    "resets invalid page %s to page 1",
    (page) => {
      expect(parseProductFilters({ page }).page).toBe(1);
    },
  );

  it("trims search text and limits it to 100 characters", () => {
    const filters = parseProductFilters({
      q: `  ${"a".repeat(110)}  `,
    });

    expect(filters.q).toBe("a".repeat(100));
  });

  it("ignores empty search text", () => {
    expect(parseProductFilters({ q: "   " }).q).toBeUndefined();
  });

  it("handles repeated query parameters safely", () => {
    const filters = parseProductFilters({
      category: ["toys", "food"],
      q: ["moon", "star"],
      sort: ["newest", "price_asc"],
      page: ["1", "2"],
    });

    expect(filters).toEqual({
      sort: "newest",
      page: 1,
    });
  });
});

describe("buildProductQuery", () => {
  it("includes the default sorting, page and page size", () => {
    const query = buildProductQuery({
      sort: "newest",
      page: 1,
    });

    expect(new URLSearchParams(query).toString()).toBe(
      `sort=newest&page=1&limit=${PRODUCTS_PER_PAGE}`,
    );
  });

  it("includes selected filters and correctly encodes search text", () => {
    const query = buildProductQuery({
      category: "toys",
      q: "moon & stars",
      sort: "price_asc",
      page: 2,
    });

    const params = new URLSearchParams(query);

    expect(params.get("category")).toBe("toys");
    expect(params.get("q")).toBe("moon & stars");
    expect(params.get("sort")).toBe("price_asc");
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("20");
  });

  it("omits category and search when no filters are selected", () => {
    const query = buildProductQuery({
      sort: "newest",
      page: 1,
    });

    const params = new URLSearchParams(query);

    expect(params.has("category")).toBe(false);
    expect(params.has("q")).toBe(false);
  });
});
