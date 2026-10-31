
-- Migration 006: Add customer shipping details to orders.

ALTER TABLE orders
ADD COLUMN first_name TEXT NOT NULL,
ADD COLUMN last_name TEXT NOT NULL,
ADD COLUMN address_line1 TEXT NOT NULL,
ADD COLUMN address_line2 TEXT,
ADD COLUMN city TEXT NOT NULL,
ADD COLUMN postal_code TEXT NOT NULL,
ADD COLUMN country TEXT NOT NULL,
ADD COLUMN phone TEXT;

-- Validate required shipping fields when provided.
-- Existing orders remain valid because these columns are nullable.
ALTER TABLE orders
ADD CONSTRAINT orders_first_name_check
    CHECK (first_name IS NULL OR length(trim(first_name)) > 0),
ADD CONSTRAINT orders_last_name_check
    CHECK (last_name IS NULL OR length(trim(last_name)) > 0),
ADD CONSTRAINT orders_address_line1_check
    CHECK (address_line1 IS NULL OR length(trim(address_line1)) > 0),
ADD CONSTRAINT orders_city_check
    CHECK (city IS NULL OR length(trim(city)) > 0),
ADD CONSTRAINT orders_postal_code_check
    CHECK (postal_code IS NULL OR length(trim(postal_code)) > 0),
ADD CONSTRAINT orders_country_check
    CHECK (country IS NULL OR length(trim(country)) > 0);
