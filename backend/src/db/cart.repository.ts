import { pool } from "./pool.js";

// Shape of each product returned by the cart API.
export type CartItem = {
  product_id: string;
  name: string;
  image_url: string | null;
  price_pawstars: number;
  quantity: number;
  subtotal_pawstars: number;
  is_available: boolean;
};

export type CartResponse = {
  items: CartItem[];
  total_pawstars: number;
};

// Reuse the same response for visitors without an active cart.
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
  // Find only carts whose expiration is still in the future.
  const cartResult = await pool.query(
    `SELECT id
     FROM carts
     WHERE token_hash = $1
       AND expires_at > NOW()`,
    [tokenHash],
  );

  // Unknown or expired tokens cannot access a cart.
  if (cartResult.rows.length === 0) {
    return emptyCart();
  }

  const cartId: string = cartResult.rows[0].id;

  // JOIN connects each cart item with its current product data.
  // We deliberately do not filter on is_active:
  // unavailable products must remain visible in existing carts.
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

      // An inactive product or insufficient stock makes
      // the item unavailable, but does not delete it.
      is_available: row.is_active === true && row.stock_quantity >= quantity,
    };
  });

  // Calculate totals from current database prices.
  // Never accept prices or totals from the browser.
  const total = items.reduce((sum, item) => sum + item.subtotal_pawstars, 0);

  return {
    items,
    total_pawstars: total,
  };
}
