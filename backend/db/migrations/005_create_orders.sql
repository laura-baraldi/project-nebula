
-- Migration 005: Create orders and order items.

-- Stores the order-level information for a completed checkout.
CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Human-readable number derived from the immutable internal ID.
    order_number TEXT GENERATED ALWAYS AS (
        'ORD-' || lpad(id::text, 8, '0')
    ) STORED UNIQUE,

    customer_email TEXT NOT NULL
        CHECK (length(trim(customer_email)) > 0),

    -- The checkout is confirmed, but payment is simulated.
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed')),

    payment_status TEXT NOT NULL DEFAULT 'simulated'
        CHECK (payment_status IN ('simulated')),

    total_pawstars INTEGER NOT NULL
        CHECK (total_pawstars >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores an immutable snapshot of each purchased product.
CREATE TABLE order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,

    product_id BIGINT NOT NULL
        REFERENCES products(id) ON DELETE RESTRICT,

    product_name TEXT NOT NULL
        CHECK (length(trim(product_name)) > 0),

    quantity INTEGER NOT NULL
        CHECK (quantity BETWEEN 1 AND 20),

    unit_price_pawstars INTEGER NOT NULL
        CHECK (unit_price_pawstars >= 0)
);

-- Supports retrieving all items belonging to an order.
CREATE INDEX order_items_order_id_idx
ON order_items (order_id);
