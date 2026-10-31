import type { PoolClient } from "pg";

import { pool } from "../pool.js";
import { CartBusinessError } from "../cart/cart.errors.js";

export interface CheckoutResult {
  order_number: string;
  customer_email: string;
  total_pawstars: number;
  payment_status: "simulated";
  created_at: Date;
  items: {
    product_name: string;
    quantity: number;
    unit_price_pawstars: number;
    line_total_pawstars: number;
  }[];
}

export interface ShippingDetails {
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code: string;
  country: string;
  phone?: string;
}

interface CheckoutCartItem {
  product_id: string;
  name: string;
  price_pawstars: number;
  quantity: number;
  stock_quantity: number;
  is_active: boolean;
}

export async function checkout(
  tokenHash: string,
  customerEmail: string,
  shipping: ShippingDetails,
): Promise<CheckoutResult> {
  const email = customerEmail.trim();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CartBusinessError(
      400,
      "INVALID_EMAIL",
      "Provide a valid email address.",
    );
  }

  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the cart so concurrent modifications must wait.
    const cartResult = await client.query<{ id: string }>(
      `SELECT id
       FROM carts
       WHERE token_hash = $1
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );

    const cartId = cartResult.rows[0]?.id;

    if (cartId === undefined) {
      throw new CartBusinessError(
        404,
        "CART_NOT_FOUND",
        "Cart not found or expired.",
      );
    }

    // Lock products in ID order to reduce deadlock risk.
    const itemsResult = await client.query<CheckoutCartItem>(
      `SELECT
         p.id AS product_id,
         p.name,
         p.price_pawstars,
         p.stock_quantity,
         p.is_active,
         ci.quantity
       FROM cart_items AS ci
       JOIN products AS p ON p.id = ci.product_id
       WHERE ci.cart_id = $1
       ORDER BY p.id
       FOR UPDATE OF p`,
      [cartId],
    );

    const items = itemsResult.rows;

    if (items.length === 0) {
      throw new CartBusinessError(
        409,
        "CART_EMPTY",
        "Cannot checkout an empty cart.",
      );
    }

    // Validate product availability and stock.
    for (const item of items) {
      if (!item.is_active) {
        throw new CartBusinessError(
          409,
          "PRODUCT_UNAVAILABLE",
          "A product in your cart is no longer available.",
        );
      }

      if (item.stock_quantity < item.quantity) {
        throw new CartBusinessError(
          409,
          "INSUFFICIENT_STOCK",
          "There is not enough stock for a product in your cart.",
        );
      }
    }

    // Prices come from PostgreSQL, never from the frontend.
    const total = items.reduce(
      (sum, item) => sum + item.price_pawstars * item.quantity,
      0,
    );

    // Create a new, independent order.
    const orderResult = await client.query<CheckoutResult>(
      `INSERT INTO orders (
     customer_email,
     first_name,
     last_name,
     address_line1,
     address_line2,
     city,
     postal_code,
     country,
     phone,
     total_pawstars
   )
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
   RETURNING
     order_number,
     customer_email,
     total_pawstars,
     payment_status,
     created_at`,
      [
        email,
        shipping.first_name,
        shipping.last_name,
        shipping.address_line1,
        shipping.address_line2 ?? null,
        shipping.city,
        shipping.postal_code,
        shipping.country,
        shipping.phone ?? null,
        total,
      ],
    );

    const order = orderResult.rows[0];

    if (order === undefined) {
      throw new Error("Failed to create order.");
    }

    // Save a snapshot of each product's name, price and quantity.
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (
           order_id,
           product_id,
           product_name,
           quantity,
           unit_price_pawstars
         )
         VALUES (
           (SELECT id FROM orders WHERE order_number = $1),
           $2,
           $3,
           $4,
           $5
         )`,
        [
          order.order_number,
          item.product_id,
          item.name,
          item.quantity,
          item.price_pawstars,
        ],
      );

      // Decrease stock only as part of this transaction.
      const stockResult = await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2
           AND is_active = TRUE
           AND stock_quantity >= $1`,
        [item.quantity, item.product_id],
      );

      if (stockResult.rowCount !== 1) {
        throw new CartBusinessError(
          409,
          "INSUFFICIENT_STOCK",
          "Product stock changed during checkout.",
        );
      }
    }

    // Keep the cart and its token, but remove its items.
    await client.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);

    // Keep the retained cart active for another seven days.
    await client.query(
      `UPDATE carts
       SET updated_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $1`,
      [cartId],
    );

    await client.query("COMMIT");

    return {
      ...order,
      items: items.map((item) => ({
        product_name: item.name,
        quantity: item.quantity,
        unit_price_pawstars: item.price_pawstars,
        line_total_pawstars: item.price_pawstars * item.quantity,
      })),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
