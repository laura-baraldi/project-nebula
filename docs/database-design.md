# Database Design: Project Nebula

> Living document. Only the database structures required for the current
> development phase are documented in detail. Last updated: 2026-10-15

## 1. Overview

Project Nebula uses PostgreSQL hosted on Neon.

The database stores persistent application data.

### Initial Scope

The current database contains three tables:

- `products`: product catalog, prices and stock.
- `carts`: persistent guest shopping carts.
- `cart_items`: products and quantities belonging to carts.

Orders, payments, hotels and experiences remain future features.

### Database Conventions

- Table names use plural `snake_case`.
- Column names use `snake_case`.
- Primary keys uniquely identify records.
- Database constraints protect data integrity.
- Timestamps use `TIMESTAMPTZ`.
- Schema changes are tracked through SQL migrations.
- The backend initially uses plain SQL without an ORM.

## 2. Products Table

### Purpose

The `products` table stores items available in the fictional Galaxy Shop.
zzini
Each row represents one product.

### SQL Schema

The current schema results from the two implemented SQL migrations.

```sql
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name TEXT NOT NULL
        CHECK (length(trim(name)) > 0),

    description TEXT NOT NULL DEFAULT '',

    price_pawstars INTEGER NOT NULL
        CHECK (price_pawstars >= 0),

    category TEXT NOT NULL
        CHECK (length(trim(category)) > 0),

    stock_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    slug TEXT NOT NULL UNIQUE
        CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

    image_url TEXT
);
```

This represents the resulting table structure. The actual migrations are
stored separately and applied in order.

### Columns

| Column           | Type        | Nullable | Default  | Purpose                   |
| ---------------- | ----------- | -------- | -------- | ------------------------- |
| `id`             | BIGINT      | No       | Identity | Unique identifier         |
| `name`           | TEXT        | No       | None     | Product name              |
| `description`    | TEXT        | No       | `''`     | Product description       |
| `price_pawstars` | INTEGER     | No       | None     | Price in Pawstars         |
| `category`       | TEXT        | No       | None     | Product category          |
| `stock_quantity` | INTEGER     | No       | 0        | Available units           |
| `is_active`      | BOOLEAN     | No       | TRUE     | Product visibility        |
| `created_at`     | TIMESTAMPTZ | No       | now()    | Creation timestamp        |
| `slug`           | TEXT        | No       | None     | Unique URL-friendly name  |
| `image_url`      | TEXT        | Yes      | NULL     | Product image URL or path |

## Shopping Cart Tables

Migration `004_create_carts.sql` introduces two tables.

### carts

Stores guest cart records.

| Column     | Type        | Constraint / Default    |
| ---------- | ----------- | ----------------------- |
| id         | BIGINT      | Identity primary key    |
| token_hash | CHAR(64)    | NOT NULL, UNIQUE        |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| expires_at | TIMESTAMPTZ | NOT NULL                |

- The original access token is stored in an HttpOnly browser cookie.
- PostgreSQL stores only its SHA-256 hash.
- The backend checks whether the cart has expired.
- PostgreSQL does not automatically delete expired records.

### cart_items

Stores individual products belonging to guest carts.

| Column     | Type        | Constraint / Default    |
| ---------- | ----------- | ----------------------- |
| id         | BIGINT      | Identity primary key    |
| cart_id    | BIGINT      | NOT NULL, foreign key   |
| product_id | BIGINT      | NOT NULL, foreign key   |
| quantity   | INTEGER     | NOT NULL, CHECK 1–20    |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

Database constraints:

- `cart_id` references `carts(id)` with `ON DELETE CASCADE`.
- `product_id` references `products(id)`.
- `UNIQUE (cart_id, product_id)` prevents duplicate products in a cart.
- `CHECK (quantity BETWEEN 1 AND 20)` enforces quantity limits.
- Deleting a cart removes its items but does not delete products.

### Cart Indexes

`carts_expires_at_idx` indexes `carts(expires_at)` to support
future cleanup of expired carts.

Primary keys and unique constraints also provide indexes.

The cart tables are covered by PostgreSQL integration tests.

## 3. Constraints and Data Types

### Primary Key

```sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

- Each product receives a unique ID.
- PostgreSQL generates IDs automatically.
- Duplicate primary keys are forbidden.
- IDs are not guaranteed to be consecutive.

### NOT NULL

Prevents SQL NULL values.

Example:

```sql
name TEXT NOT NULL
```

A product name cannot be NULL.

However, `NOT NULL` alone does not reject empty strings such as `''`.

The current database also uses CHECK constraints to reject empty or
whitespace-only names and categories.

Example:

```sql
CHECK (length(trim(name)) > 0)
```

### DEFAULT

Supplies a value when a column is omitted from an INSERT.

Example:

```sql
description TEXT NOT NULL DEFAULT ''
```

If description is omitted, PostgreSQL stores an empty string.

An explicitly provided NULL is rejected.

### CHECK

Restricts the values a column may contain.

Example:

```sql
price_pawstars INTEGER NOT NULL
    CHECK (price_pawstars >= 0)
```

The price cannot be negative.

For stock:

```sql
stock_quantity INTEGER NOT NULL DEFAULT 0
    CHECK (stock_quantity >= 0)
```

Stock cannot become negative.

For slugs:

```sql
CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
```

This restricts slugs to lowercase letters, digits and hyphens in the
supported format.

### UNIQUE

Prevents duplicate values.

Example:

```sql
slug TEXT NOT NULL UNIQUE
```

Two products cannot have the same slug.

### Data Types

`BIGINT`

- Signed 64-bit integer.
- Used for product IDs.

`INTEGER`

- Signed 32-bit integer.
- Used for prices and stock quantities.

`TEXT`

- Variable-length text.
- Used for names, descriptions, categories, slugs and image URLs.

`BOOLEAN`

- TRUE or FALSE.
- Used for product visibility.

`TIMESTAMPTZ`

- Timestamp representing an absolute point in time.
- Handles time-zone-aware input and output.
- Used for product creation timestamps.

## 4. Currency

The fictional currency is Pawstars (PWS).

Prices are stored as whole integers.

Example:

```sql
price_pawstars = 3900
```

This represents 3900 Pawstars.

There are no fractional units.

No additional currency column is needed while the application uses only
Pawstars.

## 5. Indexes

### Initial Index

```sql
CREATE INDEX products_active_category_idx
ON products (is_active, category, id);
```

### Purpose

This is an initial hypothesis for queries filtering active products by category.

Example:

```sql
SELECT *
FROM products
WHERE is_active = TRUE
  AND category = 'clothing'
ORDER BY id ASC;
```

### Trade-offs

- Indexes may improve read performance.
- Indexes consume storage.
- Inserts and updates may require index maintenance.
- Not every query benefits from every index.
- This index does not directly optimize all price or date sorting options.

The usefulness of this index will be evaluated using actual queries and
execution plans.

### Performance Analysis

Once enough sample data exists:

```sql
EXPLAIN ANALYZE
SELECT *
FROM products
WHERE is_active = TRUE
  AND category = 'clothing'
ORDER BY id ASC;
```

Additional indexes will be considered only when justified by measured
performance.

## 6. Sample Data

Initial sample products have been inserted using SQL.

The seed file is:

`backend/db/seeds/001_seed_products.sql`

The current database contains 30 fictional products across eight categories.

Example of a product insertion:

```sql
INSERT INTO products (
    name,
    description,
    price_pawstars,
    category,
    stock_quantity,
    slug
)
VALUES (
    'Sphynx Sweater',
    'Warm, because they are not.',
    3900,
    'clothing',
    14,
    'sphynx-sweater'
);
```

This example illustrates the current required columns, including `slug`.
The actual seed file contains the project's fictional product dataset.

PostgreSQL automatically supplies:

- `id`
- `is_active`
- `created_at`

The optional `image_url` can be NULL.

Additional products may be added during future development.

## 7. Database Access

The Express backend communicates with PostgreSQL using SQL.

The project uses the Node.js `pg` library.

No ORM is currently used.

### Architecture

```text
Next.js
   |
   | HTTP
   v
Express API
   |
   | Parameterized SQL
   v
PostgreSQL
```

The Next.js frontend is planned.

### Security

- Database credentials remain on the backend.
- The browser never receives database credentials.
- User-provided values must be validated.
- SQL queries use parameterized values.
- Authorization must be enforced for protected data.
- Database constraints protect data integrity.

### BIGINT and TypeScript

PostgreSQL BIGINT values can exceed JavaScript's safe integer range.

The backend must handle BIGINT identifiers without precision loss.

The `pg` library returns BIGINT values as strings by default.

The current product API returns ID values as JSON strings and validates
product IDs using `BigInt`.

### Transactions

Transactions are already used in shopping cart database integration tests
to isolate changes and roll them back.

Cart API write operations will use transactions to preserve data integrity
and handle concurrent modifications safely.

They will be especially important for:

- Order creation
- Stock updates
- Simulated checkout

## 8. Database Migrations

Schema changes are tracked in versioned SQL files.

Directory:

`backend/db/migrations/`

### Migration 001

`001_create_products.sql`

This migration creates:

- The `products` table
- Initial columns
- CHECK constraints
- The `products_active_category_idx` index

### Migration 002

`002_add_product_slug_and_image.sql`

This migration adds:

- `slug`: required, unique and validated
- `image_url`: optional image URL or path

Future migrations must account for existing records when adding required
columns or modifying constraints.

### Migration 003

`003_update_product_catalog.sql`

This migration updates product catalog content, including descriptions
and image paths.

### Migration 004

`004_create_carts.sql`

This migration creates:

- The `carts` table.
- The `cart_items` table.
- Cart token uniqueness.
- Quantity and foreign key constraints.
- Cascading deletion of cart items.
- The index on cart expiration.

Migration 004 has been applied to both the normal development database
and the dedicated Neon testing database.

Its constraints are verified by automated PostgreSQL integration tests.

### Documentation vs Migrations

`database-design.md`:

- Describes the intended and implemented schema.
- Explains data types and constraints.
- Documents design decisions.
- Discusses indexes and trade-offs.

Migration files:

- Contain executable SQL.
- Apply schema changes to PostgreSQL.
- Track database structure over time.

The project currently uses SQL migration files. An automated migration
management system has not yet been introduced.

### Database Branches

Neon is used with separate database branches.

- `production`: main application database branch.
- `testing`: dedicated branch for PostgreSQL integration tests.

The backend reads its normal database connection from `DATABASE_URL`.

Integration tests use `TEST_DATABASE_URL` to connect to the separate testing
branch.

Integration tests must not accidentally modify production data.

## 9. Open Decisions

| Decision                            | Decide By                    |
| ----------------------------------- | ---------------------------- |
| BIGINT or INTEGER IDs               | Before first migration       |
| Empty name and category constraints | Before first migration       |
| Product categories                  | Before sample data insertion |
| Product images                      | Before catalog frontend      |
| Stock display                       | Before catalog frontend      |
| Additional indexes                  | After performance analysis   |
| User and cart tables                | Before cart implementation   |
| Order and order item tables         | Before orders                |
| Stock reservation strategy          | Before checkout              |
| Payment records                     | Before simulated checkout    |

The initial decisions about BIGINT IDs, empty name/category constraints and
product categories have been implemented.

The database now includes `image_url`, but actual image storage and hosting
remain to be decided.

## 10. Future Database Expansion

The cart tables (`carts` and `cart_items`) are already implemented.

Future e-commerce tables may include:

- `users`, if customer accounts are introduced
- `orders`
- `order_items`
- `payments`

Hotel and experience functionality will require additional tables and
relationships.

Their database structures have not yet been designed.

Foreign keys, transactions and business constraints will be defined as the
corresponding features are implemented.

---

**Document status:** Product and guest cart database schemas implemented.

Migrations 001–004 are present. The cart API is still under development.
