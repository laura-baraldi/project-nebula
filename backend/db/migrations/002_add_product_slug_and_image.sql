-- Migration 002: Add product slug and image URL.

-- A slug is a unique, URL-friendly identifier.
-- Example: "Moonwarm Bodysuit" -> "moonwarm-bodysuit".
ALTER TABLE products
ADD COLUMN slug TEXT NOT NULL UNIQUE
CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Stores the path or URL to the product's main image.
-- NULL is allowed until an image is available.
ALTER TABLE products
ADD COLUMN image_url TEXT;