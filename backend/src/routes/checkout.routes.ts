import { Router } from "express";

import { readCartToken, setCartCookie } from "../cart-cookie.js";
import { hashCartToken } from "../cart-token.js";
import { cartSecurity } from "../cart-security.js";
import { CartBusinessError } from "../db/cart.repository.js";
import {
  checkout,
  type ShippingDetails,
} from "../db/checkout/checkout.repository.js";
import { sendOrderConfirmationEmail } from "../email/email.service.js";

export const checkoutRouter = Router();

checkoutRouter.use(cartSecurity);

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

    // Accept only the supported customer and shipping fields.
    const requiredFields = [
      "customer_email",
      "first_name",
      "last_name",
      "address_line1",
      "city",
      "postal_code",
      "country",
    ];

    const allowedFields = [...requiredFields, "address_line2", "phone"];

    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !allowedFields.includes(key)) ||
      requiredFields.some(
        (field) =>
          !Object.hasOwn(body, field) ||
          typeof body[field] !== "string" ||
          body[field].trim().length === 0,
      ) ||
      ["address_line2", "phone"].some(
        (field) =>
          Object.hasOwn(body, field) && typeof body[field] !== "string",
      )
    ) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Provide valid customer and shipping details.",
        },
      });
      return;
    }

    const shipping: ShippingDetails = {
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      address_line1: body.address_line1.trim(),
      address_line2: body.address_line2?.trim() || undefined,
      city: body.city.trim(),
      postal_code: body.postal_code.trim(),
      country: body.country.trim(),
      phone: body.phone?.trim() || undefined,
    };

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

    const order = await checkout(
      tokenHash,
      body.customer_email.trim(),
      shipping,
    );

    try {
      await sendOrderConfirmationEmail(
        body.customer_email.trim(),
        order.order_number,
      );
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
    }

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
