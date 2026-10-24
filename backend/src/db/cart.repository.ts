import type { PoolClient } from "pg";
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

// Business errors are different from unexpected database failures.
// The route can use these to return the correct HTTP status.
export class CartBusinessError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

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

// Add a product to a cart atomically.
//
// existingTokenHash:
//   Hash of the visitor's existing cookie, or null.
//
// newTokenHash:
//   Hash of a newly generated token, used only when
//   the visitor needs a new cart.
//
// Returns whether a new cart was created.
export async function addCartItem(
  existingTokenHash: string | null,
  newTokenHash: string,
  productId: string,
  quantity: number,
): Promise<{ created: boolean }> {
  // Acquire one dedicated connection for the transaction.
  // Every statement between BEGIN and COMMIT must use
  // this same client, not pool.query().
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    let cartId: string | null = null;

    if (existingTokenHash !== null) {
      // Lock the cart row while changing its contents.
      // Concurrent additions to the same cart must wait
      // rather than overwrite each other's quantities.
      const cartResult = await client.query(
        `SELECT id
         FROM carts
         WHERE token_hash = $1
           AND expires_at > NOW()
         FOR UPDATE`,
        [existingTokenHash],
      );

      cartId = cartResult.rows[0]?.id ?? null;
    }

    // Lock the product while validating availability.
    // This ensures the stock value cannot be modified
    // concurrently by another transaction holding the row.
    const productResult = await client.query(
      `SELECT id, is_active, stock_quantity
       FROM products
       WHERE id = $1::bigint
       FOR UPDATE`,
      [productId],
    );

    const product = productResult.rows[0];

    if (!product || !product.is_active) {
      throw new CartBusinessError(
        404,
        "PRODUCT_NOT_FOUND",
        "Product not found.",
      );
    }

    let currentQuantity = 0;

    if (cartId !== null) {
      const itemResult = await client.query(
        `SELECT quantity
         FROM cart_items
         WHERE cart_id = $1
           AND product_id = $2`,
        [cartId, productId],
      );

      currentQuantity = itemResult.rows[0]?.quantity ?? 0;
    }

    const newQuantity = currentQuantity + quantity;

    // Enforce the quantity limit before writing anything.
    if (newQuantity > 20) {
      throw new CartBusinessError(
        409,
        "QUANTITY_LIMIT_EXCEEDED",
        "Maximum quantity per product is 20.",
      );
    }

    // Adding items cannot exceed currently available stock.
    if (newQuantity > product.stock_quantity) {
      throw new CartBusinessError(
        409,
        "INSUFFICIENT_STOCK",
        "Not enough stock available.",
      );
    }

    const created = cartId === null;

    if (cartId === null) {
      // A new cart is created only after the product,
      // quantity and stock have passed validation.
      const newCart = await client.query(
        `INSERT INTO carts (token_hash, expires_at)
         VALUES ($1, NOW() + INTERVAL '7 days')
         RETURNING id`,
        [newTokenHash],
      );

      cartId = newCart.rows[0].id;
    }

    // A product must have only one row per cart.
    // If it already exists, replace its quantity with
    // the newly calculated total.
    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET
         quantity = EXCLUDED.quantity,
         updated_at = NOW()`,
      [cartId, productId, newQuantity],
    );

    // Successful modifications renew expiration.
    // GET requests never perform this update.
    await client.query(
      `UPDATE carts
       SET updated_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $1`,
      [cartId],
    );

    // All database modifications become permanent together.
    await client.query("COMMIT");

    return { created };
  } catch (error) {
    // If a query or business validation fails,
    // undo every modification made in this transaction.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // Always return the connection to PostgreSQL's pool.
    client.release();
  }
}
