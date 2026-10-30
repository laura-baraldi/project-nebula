import { Router } from "express";

import { readCartToken, setCartCookie } from "../cart-cookie.js";
import { hashCartToken } from "../cart-token.js";
import { cartSecurity } from "../cart-security.js";
import { CartBusinessError } from "../db/cart.repository.js";
import { checkout } from "../db/checkout/checkout.repository.js";
import { sendOrderConfirmationEmail } from "../email/email.service.js";

export const checkoutRouter = Router();

// Apply the same Origin protection used by cart modifications.
checkoutRouter.use(cartSecurity);

// POST /api/cart/checkout
checkoutRouter.post("/", async (req, res) => {
  try {
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

    // Accept exactly one field: customer_email.
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, "customer_email") ||
      typeof body.customer_email !== "string"
    ) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Provide a valid customer_email.",
        },
      });
      return;
    }

    const token = readCartToken(req);

    if (token === null) {
      res.status(404).json({
        error: {
          code: "CART_NOT_FOUND",
          message: "Cart not found.",
        },
      });
      return;
    }

    const tokenHash = hashCartToken(token);

    // The repository validates the email and performs the transaction.
    const order = await checkout(tokenHash, body.customer_email);

    // Send the confirmation email after the order has been created.
    // Email failures must not undo a successful checkout.
    try {
      await sendOrderConfirmationEmail(body.customer_email, order.order_number);
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
    }

    // Keep the same cart token and renew its seven-day cookie.
    setCartCookie(res, token);

    res.status(201).json({
      order,
    });
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

    console.error("Failed to checkout:", error);

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to checkout.",
      },
    });
  }
});
