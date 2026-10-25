import type { PoolClient } from "pg";
import { pool } from "../pool.js";
import { CartBusinessError } from "./cart.errors.js";

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

/**
 * Replace the quantity of an existing cart item.
 *
 * PATCH replaces the quantity; POST increases it.
 * Successful updates renew cart expiration by seven days.
 */
export async function updateCartItemQuantity(
  tokenHash: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the existing, non-expired cart.
    const cartResult = await client.query(
      `SELECT id
       FROM carts
       WHERE token_hash = $1
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );

    const cartId: string | undefined = cartResult.rows[0]?.id;

    if (cartId === undefined) {
      throw new CartBusinessError(404, "CART_NOT_FOUND", "Cart not found.");
    }

    // PATCH only updates products already in the cart.
    const itemResult = await client.query(
      `SELECT quantity
       FROM cart_items
       WHERE cart_id = $1
         AND product_id = $2`,
      [cartId, productId],
    );

    const existingQuantity: number | undefined = itemResult.rows[0]?.quantity;

    if (existingQuantity === undefined) {
      throw new CartBusinessError(
        404,
        "CART_ITEM_NOT_FOUND",
        "Product not found in cart.",
      );
    }

    // Lock the product before checking stock.
    const productResult = await client.query(
      `SELECT is_active, stock_quantity
       FROM products
       WHERE id = $1::bigint
       FOR UPDATE`,
      [productId],
    );

    const product = productResult.rows[0];

    // Unavailable products may be reduced but not increased.
    if (quantity > existingQuantity) {
      if (!product || product.is_active !== true) {
        throw new CartBusinessError(
          409,
          "PRODUCT_UNAVAILABLE",
          "Product is no longer available.",
        );
      }

      if (quantity > product.stock_quantity) {
        throw new CartBusinessError(
          409,
          "INSUFFICIENT_STOCK",
          "Not enough stock available.",
        );
      }
    }

    // Replace the quantity rather than adding to it.
    await client.query(
      `UPDATE cart_items
       SET quantity = $1,
           updated_at = NOW()
       WHERE cart_id = $2
         AND product_id = $3`,
      [quantity, cartId, productId],
    );

    // Renew the cart expiration after a successful update.
    await client.query(
      `UPDATE carts
       SET updated_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $1`,
      [cartId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
