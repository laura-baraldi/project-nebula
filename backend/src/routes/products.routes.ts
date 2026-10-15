import { Router } from "express";
import { pool } from "../db/pool.js";

export const productsRouter = Router();

// Maps allowed sort options to SQL clauses.
// "as const" makes properties readonly and preserves literal types.
const sortOptions = {
  newest: "created_at DESC, id DESC",
  price_asc: "price_pawstars ASC, id ASC",
  price_desc: "price_pawstars DESC, id DESC",
  name_asc: "name ASC, id ASC",
} as const;

// GET /api/products
// List active products with pagination, sorting, and filters.
productsRouter.get("/", async (req, res) => {
  try {
    // Define the allowed query parameters.
    const allowedParams = new Set([
      "page",
      "limit",
      "sort",
      "category",
      "min_price",
      "max_price",
      "q",
    ]);

    // Reject any query parameter that is not allowed.
    for (const param of Object.keys(req.query)) {
      if (!allowedParams.has(param)) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Unknown query parameter: ${param}`,
          },
        });
        return;
      }
    }

    // Read pagination, sorting, and filter parameters from the URL.
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const sort = req.query.sort ?? "newest";
    const category = req.query.category;
    const minPrice = req.query.min_price;
    const maxPrice = req.query.max_price;
    const q = req.query.q;

    // Validate the requested sort option.
    if (
      typeof sort !== "string" ||
      !Object.prototype.hasOwnProperty.call(sortOptions, sort)
    ) {
      res.status(400).json({
        error: {
          code: "INVALID_SORT",
          message: "Invalid sort option.",
        },
      });
      return;
    }

    // Validate the optional category parameter.
    if (category !== undefined && typeof category !== "string") {
      res.status(400).json({
        error: {
          code: "INVALID_CATEGORY",
          message: "Category must be a string.",
        },
      });
      return;
    }

    // Validate the optional search query.
    if (q !== undefined && typeof q !== "string") {
      res.status(400).json({
        error: {
          code: "INVALID_SEARCH",
          message: "Search query must be a string.",
        },
      });
      return;
    }

    // Remove surrounding whitespace from the search query.
    // An empty search is treated as no search filter.
    const search = q?.trim() || null;

    // Convert optional price filters to numbers.
    const min = minPrice === undefined ? null : Number(minPrice);
    const max = maxPrice === undefined ? null : Number(maxPrice);

    // Maximum value supported by PostgreSQL INTEGER.
    const MAX_PRICE = 2147483647;

    // Validate price filters.
    if (
      (min !== null &&
        (!Number.isSafeInteger(min) || min < 0 || min > MAX_PRICE)) ||
      (max !== null &&
        (!Number.isSafeInteger(max) || max < 0 || max > MAX_PRICE)) ||
      (min !== null && max !== null && min > max)
    ) {
      res.status(400).json({
        error: {
          code: "INVALID_PRICE_RANGE",
          message:
            "Prices must be non-negative integers within the supported range, and min_price cannot exceed max_price.",
        },
      });
      return;
    }

    // Validate pagination parameters.
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      res.status(400).json({
        error: {
          code: "INVALID_PAGINATION",
          message:
            "Page must be a positive integer and limit must be between 1 and 100.",
        },
      });
      return;
    }

    // Get the SQL ordering clause for the selected sort option.
    const orderBy = sortOptions[sort as keyof typeof sortOptions];

    // Calculate how many products to skip.
    const offset = (page - 1) * limit;

    // Count all active products matching the filters.
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM products
       WHERE is_active = TRUE
       AND ($1::text IS NULL OR category = $1)
       AND ($2::int IS NULL OR price_pawstars >= $2)
       AND ($3::int IS NULL OR price_pawstars <= $3)
       AND ($4::text IS NULL OR name ILIKE '%' || $4 || '%')`,
      [category ?? null, min, max, search],
    );

    const total: number = countResult.rows[0].total;

    // Fetch products using filters, sorting, and pagination.
    const result = await pool.query(
      `SELECT *
       FROM products
       WHERE is_active = TRUE
       AND ($1::text IS NULL OR category = $1)
       AND ($2::int IS NULL OR price_pawstars >= $2)
       AND ($3::int IS NULL OR price_pawstars <= $3)
       AND ($4::text IS NULL OR name ILIKE '%' || $4 || '%')
       ORDER BY ${orderBy}
       LIMIT $5 OFFSET $6`,
      [category ?? null, min, max, search, limit, offset],
    );

    res.status(200).json({
      items: result.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Failed to fetch products:", error);

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch products",
      },
    });
  }
});

// GET /api/products/:id
// Fetch a single active product by its ID.
productsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // PostgreSQL BIGINT supports positive 64-bit integers.
    // Validate the ID as a string to avoid JavaScript precision loss.
    if (
      typeof id !== "string" ||
      !/^[1-9]\d*$/.test(id) ||
      BigInt(id) > 9223372036854775807n
    ) {
      res.status(400).json({
        error: {
          code: "INVALID_PRODUCT_ID",
          message: "Product ID must be a valid positive integer.",
        },
      });
      return;
    }

    // Query the database using a parameterized SQL statement.
    const result = await pool.query(
      `SELECT *
       FROM products
       WHERE id = $1::bigint AND is_active = TRUE`,
      [id],
    );

    // Return 404 if the product does not exist or is inactive.
    if (result.rows.length === 0) {
      res.status(404).json({
        error: {
          code: "PRODUCT_NOT_FOUND",
          message: "Product not found.",
        },
      });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to fetch product:", error);

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch product",
      },
    });
  }
});
