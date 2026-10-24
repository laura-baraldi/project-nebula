import { Router } from "express";

import { readCartToken, setCartCookie } from "../cart-cookie.js";
import { generateCartToken, hashCartToken } from "../cart-token.js";
import { cartSecurity } from "../cart-security.js";
import {
  CartBusinessError,
  addCartItem,
  emptyCart,
  getCartByTokenHash,
} from "../db/cart.repository.js";

export const cartRouter = Router();

// Apply CORS and origin protection to all cart endpoints.
cartRouter.use(cartSecurity);

// Validate PostgreSQL BIGINT product IDs without losing precision.
function isValidProductId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

// GET /api/cart
cartRouter.get("/", async (req, res) => {
  try {
    const token = readCartToken(req);

    if (token === null) {
      res.status(200).json(emptyCart());
      return;
    }

    const cart = await getCartByTokenHash(hashCartToken(token));

    res.status(200).json(cart);
  } catch (error) {
    console.error("Failed to fetch cart:", error);

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch cart.",
      },
    });
  }
});

// POST /api/cart/items
cartRouter.post("/items", async (req, res) => {
  try {
    // Only accept JSON requests.
    if (!req.is("application/json")) {
      res.status(415).json({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Content-Type must be application/json.",
        },
      });
      return;
    }

    const body = req.body;

    // Require exactly the two fields defined by the API.
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 2 ||
      !Object.hasOwn(body, "product_id") ||
      !Object.hasOwn(body, "quantity") ||
      !isValidProductId(body.product_id) ||
      !Number.isInteger(body.quantity) ||
      body.quantity < 1 ||
      body.quantity > 20
    ) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Provide a valid product_id and quantity (1-20).",
        },
      });
      return;
    }

    const productId: string = body.product_id;
    const quantity: number = body.quantity;

    // Read an existing guest token, if available.
    const existingToken = readCartToken(req);

    // Generate a replacement token only if a new cart is needed.
    // The repository will use its hash when inserting a new cart.
    const newToken = generateCartToken();

    const existingTokenHash = existingToken
      ? hashCartToken(existingToken)
      : null;

    const newTokenHash = hashCartToken(newToken);

    // Validate stock and persist the addition in one transaction.
    const result = await addCartItem(
      existingTokenHash,
      newTokenHash,
      productId,
      quantity,
    );

    // If an existing cart was found, retain its original token.
    // Otherwise use the newly generated token.
    const activeToken = result.created ? newToken : existingToken!;

    const activeTokenHash = hashCartToken(activeToken);

    // Return updated data using current prices from PostgreSQL.
    const cart = await getCartByTokenHash(activeTokenHash);

    // Only successful additions set or renew the cookie.
    setCartCookie(res, activeToken);

    res.status(result.created ? 201 : 200).json(cart);
  } catch (error) {
    if (error instanceof CartBusinessError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    console.error("Failed to add cart item:", error);

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add cart item.",
      },
    });
  }
});
