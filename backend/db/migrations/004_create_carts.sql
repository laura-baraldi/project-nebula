
-- Migration 004: Create guest shopping cart tables.

-- Each cart belongs to a guest holding a valid access token.
CREATE TABLE carts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- SHA-256 hash of the secret cart token.
    token_hash CHAR(64) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Each row represents one product in a cart.
CREATE TABLE cart_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    cart_id BIGINT NOT NULL
        REFERENCES carts(id) ON DELETE CASCADE,

    product_id BIGINT NOT NULL
        REFERENCES products(id),

    quantity INTEGER NOT NULL
        CHECK (quantity BETWEEN 1 AND 20),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate products in the same cart.
    CONSTRAINT cart_items_cart_product_unique
        UNIQUE (cart_id, product_id)
);

-- Helps identify expired carts for cleanup.
CREATE INDEX carts_expires_at_idx
ON carts (expires_at);
