import type { PoolClient } from "pg";

import { pool } from "../pool.js";
import { CartBusinessError } from "./cart.errors.js";

/**
 * Remove an existing product from a guest cart.
 *
 * The cart remains valid even when its last item is removed.
 * Successful deletions renew the cart expiration by seven days.
 */
export async function removeCartItem(
  tokenHash: string,
  productId: string,
): Promise<void> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the cart to prevent concurrent modifications.
    // Expired or nonexistent carts cannot be modified.
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

    // Delete only the specified product from this cart.
    // No stock check is necessary for removing an item.
    const deletedItem = await client.query(
      `DELETE FROM cart_items
       WHERE cart_id = $1
         AND product_id = $2
       RETURNING id`,
      [cartId, productId],
    );

    // No returned row means the product was not in the cart.
    if (deletedItem.rows.length === 0) {
      throw new CartBusinessError(
        404,
        "CART_ITEM_NOT_FOUND",
        "Product not found in cart.",
      );
    }

    // Renew expiration only after a successful deletion.
    await client.query(
      `UPDATE carts
       SET updated_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $1`,
      [cartId],
    );

    await client.query("COMMIT");
  } catch (error) {
    // Undo the transaction if any operation fails.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // Always release the PostgreSQL connection.
    client.release();
  }
}
