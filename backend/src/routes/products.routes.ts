import { Router } from "express";
import { pool } from "../db/pool.js";

export const productsRouter = Router();

// Maps allowed sort options to SQL clauses.
const sortOptions = {
  newest: "created_at DESC, id DESC",
  price_asc: "price_pawstars ASC, id ASC",
  price_desc: "price_pawstars DESC, id DESC",
  name_asc: "name ASC, id ASC",
} as const;

// Maximum value supported by PostgreSQL INTEGER.
const MAX_PRICE = 2147483647;

// Validates a decimal integer without accepting empty strings,
// scientific notation, hexadecimal values or decimal points.
function isDecimalInteger(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

// GET /api/products
// List active products with pagination, sorting and filters.
productsRouter.get("/", async (req, res) => {
  try {
    const allowedParams = new Set([
      "page",
      "limit",
      "sort",
      "category",
      "min_price",
      "max_price",
      "q",
    ]);

    // Reject unknown or repeated query parameters.
    const queryParams = new URLSearchParams(
      req.originalUrl.split("?")[1] ?? "",
    );

    for (const [param] of queryParams) {
      if (!allowedParams.has(param)) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Unknown query parameter: ${param}`,
          },
        });
        return;
      }

      if (queryParams.getAll(param).length > 1) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: `Repeated query parameter: ${param}`,
          },
        });
        return;
      }
    }

    // Read pagination, sorting and filtering parameters.
    const rawPage = req.query.page ?? "1";
    const rawLimit = req.query.limit ?? "20";
    const sort = req.query.sort ?? "newest";
    const category = queryParams.get("category");
    const minPrice = req.query.min_price;
    const maxPrice = req.query.max_price;
    const q = queryParams.get("q");

    // Validate pagination before converting to numbers.
    if (!isDecimalInteger(rawPage) || !isDecimalInteger(rawLimit)) {
      res.status(400).json({
        error: {
          code: "INVALID_PAGINATION",
          message:
            "Page must be a positive integer and limit must be between 1 and 100.",
        },
      });
      return;
    }

    const page = Number(rawPage);
    const limit = Number(rawLimit);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
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

    const normalizedCategory = category?.trim() || null;

    const search = q?.trim() || null;

    if (search !== null && search.length > 100) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Search query must not exceed 100 characters.",
        },
      });
      return;
    }

    // Validate price formats before numeric conversion.
    if (
      (minPrice !== undefined && !isDecimalInteger(minPrice)) ||
      (maxPrice !== undefined && !isDecimalInteger(maxPrice))
    ) {
      res.status(400).json({
        error: {
          code: "INVALID_PRICE_RANGE",
          message: "Prices must be non-negative decimal integers.",
        },
      });
      return;
    }

    const min = minPrice === undefined ? null : Number(minPrice);
    const max = maxPrice === undefined ? null : Number(maxPrice);

    // Validate price limits and range.
    if (
      (min !== null && (!Number.isSafeInteger(min) || min > MAX_PRICE)) ||
      (max !== null && (!Number.isSafeInteger(max) || max > MAX_PRICE)) ||
      (min !== null && max !== null && min > max)
    ) {
      res.status(400).json({
        error: {
          code: "INVALID_PRICE_RANGE",
          message:
            "Prices must be within the supported range, and min_price cannot exceed max_price.",
        },
      });
      return;
    }

    // Get the SQL ordering clause for the selected sort option.
    const orderBy = sortOptions[sort as keyof typeof sortOptions];

    // Calculate how many products to skip.
    const offset = (page - 1) * limit;

    // Reject offsets outside JavaScript's safe integer range.
    if (!Number.isSafeInteger(offset)) {
      res.status(400).json({
        error: {
          code: "INVALID_PAGINATION",
          message: "Pagination offset exceeds the supported range.",
        },
      });
      return;
    }

    // Count active products matching the filters.
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM products
       WHERE is_active = TRUE
       AND ($1::text IS NULL OR category = $1)
       AND ($2::int IS NULL OR price_pawstars >= $2)
       AND ($3::int IS NULL OR price_pawstars <= $3)
       AND ($4::text IS NULL OR name ILIKE '%' || $4 || '%')`,
      [normalizedCategory, min, max, search],
    );

    const total: number = countResult.rows[0].total;

    // Fetch products using filters, sorting and pagination.
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
      [normalizedCategory, min, max, search, limit, offset],
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

    // Validate PostgreSQL BIGINT IDs without JavaScript precision loss.
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

    // Fetch the active product using a parameterized query.
    const result = await pool.query(
      `SELECT *
       FROM products
       WHERE id = $1::bigint AND is_active = TRUE`,
      [id],
    );

    // Missing or inactive products return HTTP 404.
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
