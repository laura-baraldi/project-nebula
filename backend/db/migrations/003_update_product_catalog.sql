
-- Migration 003: Update product image paths and public descriptions.
-- Existing product IDs, prices, stock quantities and categories remain unchanged.

BEGIN;

-- Images are stored in category-specific frontend folders.
-- The database category "tech" corresponds to the folder "technology".
UPDATE products
SET image_url =
    '/products/' ||
    CASE
        WHEN category = 'tech' THEN 'technology'
        ELSE category
    END ||
    '/' || slug || '.webp'
WHERE category IN (
    'accessories',
    'clothing',
    'food',
    'home',
    'skincare',
    'tech',
    'toys',
    'travel'
);

-- Update selected product descriptions for the revised catalog.
UPDATE products
SET description = CASE slug
    WHEN 'cozy-climate-pad' THEN
        'An intelligent heating pad that automatically adjusts to keep your little alien companion cozy.'

    WHEN 'cosmic-tuna-cubes' THEN
        'Soft tuna-flavored treats for the galaxy''s most demanding little alien cats.'

    WHEN 'purrship-mini' THEN
        'A luxurious miniature spacecraft with a heated seat for one very special alien cat.'

    WHEN 'comet-stroller' THEN
        'A premium futuristic stroller for royal or exceptionally sleepy little space explorers.'

    ELSE description
END
WHERE slug IN (
    'cozy-climate-pad',
    'cosmic-tuna-cubes',
    'purrship-mini',
    'comet-stroller'
);

COMMIT;
