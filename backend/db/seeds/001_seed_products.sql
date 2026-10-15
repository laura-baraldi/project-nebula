
-- Seed 001: Initial Project Nebula catalog.
-- 30 products across 8 categories.
-- Prices are expressed in whole Pawstars (PWS).
-- Product images will be added to the frontend later.

INSERT INTO products (
    name,
    slug,
    description,
    price_pawstars,
    category,
    stock_quantity,
    image_url
)
VALUES
    -- CLOTHING (4)
    ('Moonwarm Bodysuit', 'moonwarm-bodysuit',
     'A thermal bodysuit designed to keep hairless explorers warm on chilly planets.',
     3900, 'clothing', 18, '/products/moonwarm-bodysuit.webp'),

    ('Stardust Pajamas', 'stardust-pajamas',
     'Ultra-soft pajamas embroidered with tiny stars for peaceful cosmic dreams.',
     2400, 'clothing', 22, '/products/stardust-pajamas.webp'),

    ('Solar Snuggle Cape', 'solar-snuggle-cape',
     'A cozy thermal cape for evening walks through the space station.',
     2700, 'clothing', 14, '/products/solar-snuggle-cape.webp'),

    ('Comet Ear Hoodie', 'comet-ear-hoodie',
     'A warm hoodie with specially shaped openings for magnificent Sphynx ears.',
     2100, 'clothing', 20, '/products/comet-ear-hoodie.webp'),

    -- HOME (5)
    ('Solar Belly Pod', 'solar-belly-pod',
     'A luxurious heated sleeping capsule designed for delicate hairless bellies.',
     8200, 'home', 8, '/products/solar-belly-pod.webp'),

    ('Lunar Heated Nest', 'lunar-heated-nest',
     'A soft heated nest for long naps beneath distant moons.',
     3100, 'home', 17, '/products/lunar-heated-nest.webp'),

    ('Zero-G Blanket', 'zero-g-blanket',
     'A lightweight thermal blanket for maximum warmth in zero gravity.',
     1600, 'home', 28, '/products/zero-g-blanket.webp'),

    ('Nebula Window Perch', 'nebula-window-perch',
     'A comfortable observation perch for watching passing comets.',
     2900, 'home', 11, '/products/nebula-window-perch.webp'),

    ('Orbit Nap Tunnel', 'orbit-nap-tunnel',
     'An insulated sleeping tunnel for shy explorers seeking warmth and privacy.',
     3400, 'home', 9, '/products/orbit-nap-tunnel.webp'),

    -- SKINCARE (3)
    ('Moondew Skin Cream', 'moondew-skin-cream',
     'A fictional lunar-inspired moisturizer created for sensitive Sphynx skin.',
     1450, 'skincare', 25, '/products/moondew-skin-cream.webp'),

    ('Solar Paw Balm', 'solar-paw-balm',
     'A fictional soothing balm for paws after long planetary adventures.',
     980, 'skincare', 30, '/products/solar-paw-balm.webp'),

    ('Velvet Skin Serum', 'velvet-skin-serum',
     'An imaginary premium serum fit for distinguished hairless citizens.',
     1750, 'skincare', 13, '/products/velvet-skin-serum.webp'),

    -- TECHNOLOGY (5)
    ('Galactic Feeder', 'galactic-feeder',
     'A smart automatic feeder with programmable orbital meal schedules.',
     4600, 'tech', 10, '/products/galactic-feeder.webp'),

    ('Nebula Water Fountain', 'nebula-water-fountain',
     'A quiet futuristic fountain providing a continuous stream of fresh water.',
     3800, 'tech', 12, '/products/nebula-water-fountain.webp'),

    ('Cozy Climate Pad', 'cozy-climate-pad',
     'An intelligent heating pad that automatically adjusts to your Puzzino.',
     4200, 'tech', 7, '/products/cozy-climate-pad.webp'),

    ('Astro Litter Hub', 'astro-litter-hub',
     'A semi-automated litter station with a sleek spacecraft-inspired design.',
     9600, 'tech', 6, '/products/astro-litter-hub.webp'),

    ('Purr Frequency Speaker', 'purr-frequency-speaker',
     'A compact speaker playing soothing sounds inspired by interstellar purrs.',
     3300, 'tech', 15, '/products/purr-frequency-speaker.webp'),

    -- TOYS (4)
    ('Anti-Gravity Yarn', 'anti-gravity-yarn',
     'A floating yarn ball that keeps escaping curious little paws.',
     950, 'toys', 35, '/products/anti-gravity-yarn.webp'),

    ('Orbit Feather Drone', 'orbit-feather-drone',
     'A miniature hovering drone carrying an irresistible floating feather.',
     1900, 'toys', 18, '/products/orbit-feather-drone.webp'),

    ('Mini Meteor Teaser', 'mini-meteor-teaser',
     'A playful teaser wand with a tiny meteor-shaped charm.',
     620, 'toys', 40, '/products/mini-meteor-teaser.webp'),

    ('Moon Mouse Rover', 'moon-mouse-rover',
     'A robotic space mouse ready for high-speed corridor adventures.',
     2100, 'toys', 14, '/products/moon-mouse-rover.webp'),

    -- FOOD (4)
    ('Meteor Munchies', 'meteor-munchies',
     'Crunchy fictional cat treats shaped like miniature meteorites.',
     320, 'food', 50, '/products/meteor-munchies.webp'),

    ('Saturn Salmon Bites', 'saturn-salmon-bites',
     'Imaginary salmon bites inspired by the rings of Saturn.',
     540, 'food', 34, '/products/saturn-salmon-bites.webp'),

    ('Cosmic Tuna Cubes', 'cosmic-tuna-cubes',
     'Soft tuna-flavored treats for the galaxy’s most demanding Puzzini.',
     610, 'food', 26, '/products/cosmic-tuna-cubes.webp'),

    ('Milky Way Treat Drops', 'milky-way-treat-drops',
     'Creamy fictional reward treats for little cosmic adventurers.',
     430, 'food', 37, '/products/milky-way-treat-drops.webp'),

    -- ACCESSORIES (2)
    ('Stardust Collar', 'stardust-collar',
     'An elegant lightweight collar with a glowing star pendant.',
     780, 'accessories', 24, '/products/stardust-collar.webp'),

    ('Orbit Harness', 'orbit-harness',
     'A comfortable adjustable harness for safe planetary exploration.',
     2300, 'accessories', 16, '/products/orbit-harness.webp'),

    -- TRAVEL (3)
    ('Purrship Mini', 'purrship-mini',
     'A luxurious miniature spacecraft with a heated seat for one Puzzino.',
     18500, 'travel', 4, '/products/purrship-mini.webp'),

    ('Cosmo Carrier Pod', 'cosmo-carrier-pod',
     'A futuristic travel carrier with a panoramic observation window.',
     6800, 'travel', 7, '/products/cosmo-carrier-pod.webp'),

    ('Comet Stroller', 'comet-stroller',
     'A premium futuristic stroller for royal or exceptionally sleepy Puzzini.',
     7900, 'travel', 5, '/products/comet-stroller.webp');
