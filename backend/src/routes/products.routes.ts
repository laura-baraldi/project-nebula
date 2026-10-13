
import { Router } from "express";

import { pool } from "../db/pool.js";

export const productsRouter = Router();


productsRouter.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products WHERE is_active = TRUE"
    );

    res.status(200).json({
      items: result.rows
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
