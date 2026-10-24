import { pool } from "../pool.js";
import type { CartItem, CartResponse } from "./cart.types.js";

// Return a consistent response for visitors without an active cart.
export function emptyCart(): CartResponse {
  return {
    items: [],
    total_pawstars: 0,
  };
}

// Receive a TOKEN HASH, never the original secret token.
export async function getCartByTokenHash(
  tokenHash: string,
): Promise<CartResponse> {
  // Only carts whose expiration is in the future are accessible.
  const cartResult = await pool.query(
    `SELECT id
     FROM carts
     WHERE token_hash = $1
       AND expires_at > NOW()`,
    [tokenHash],
  );

  // Unknown or expired tokens return an empty cart.
  if (cartResult.rows.length === 0) {
    return emptyCart();
  }

  const cartId: string = cartResult.rows[0].id;

  // JOIN connects cart items to their current product data.
  // Do not filter on is_active: unavailable products must
  // remain visible in existing carts.
  const result = await pool.query(
    `SELECT
       p.id AS product_id,
       p.name,
       p.image_url,
       p.price_pawstars,
       p.stock_quantity,
       p.is_active,
       ci.quantity
     FROM cart_items AS ci
     JOIN products AS p ON p.id = ci.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.id ASC`,
    [cartId],
  );

  const items: CartItem[] = result.rows.map((row) => {
    const price: number = row.price_pawstars;
    const quantity: number = row.quantity;

    return {
      // pg returns PostgreSQL BIGINT values as strings.
      product_id: row.product_id,
      name: row.name,
      image_url: row.image_url,
      price_pawstars: price,
      quantity,
      subtotal_pawstars: price * quantity,

      // Unavailable products remain visible but are marked.
      is_available: row.is_active === true && row.stock_quantity >= quantity,
    };
  });

  // Calculate totals using current database prices.
  // Never trust prices or totals supplied by the frontend.
  const total = items.reduce((sum, item) => sum + item.subtotal_pawstars, 0);

  return {
    items,
    total_pawstars: total,
  };
}
