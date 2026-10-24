import { Router } from "express";

import { readCartToken } from "../cart-cookie.js";
import { hashCartToken } from "../cart-token.js";
import { emptyCart, getCartByTokenHash } from "../db/cart.repository.js";

export const cartRouter = Router();

// GET /api/cart
// Retrieve the current visitor's cart without modifying it.
cartRouter.get("/", async (req, res) => {
  try {
    // Read the original token from the incoming Cookie header.
    const token = readCartToken(req);

    // No token: return an empty cart without querying PostgreSQL.
    // A GET request must never create a cart or cookie.
    if (token === null) {
      res.status(200).json(emptyCart());
      return;
    }

    // The database stores SHA-256 hashes, not original tokens.
    const tokenHash = hashCartToken(token);

    // Look up the cart and calculate its current totals.
    const cart = await getCartByTokenHash(tokenHash);

    res.status(200).json(cart);
  } catch (error) {
    console.error("Failed to fetch cart:", error);

    // Do not expose database or internal error details.
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch cart.",
      },
    });
  }
});
