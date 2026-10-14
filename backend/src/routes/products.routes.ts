
import { Router } from "express";
import { pool } from "../db/pool.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res) => {
  try {
    // Read page and limit from the query string.
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

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
          message: "Page must be a positive integer and limit must be between 1 and 100."
        }
      });
      return;
    }

    // Calculate how many products to skip.
    const offset = (page - 1) * limit;

    // Count all active products.
    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS total FROM products WHERE is_active = TRUE"
    );

    const total: number = countResult.rows[0].total;

    // Fetch only the products belonging to the requested page.
    const result = await pool.query(
      `SELECT *
       FROM products
       WHERE is_active = TRUE
       ORDER BY created_at DESC, id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.status(200).json({
      items: result.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Failed to fetch products:", error);

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch products"
      }
    });
  }
});
