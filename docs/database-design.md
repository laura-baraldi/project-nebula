# Database Design: Project Nebula

> Living document. Only the database structures required for the current
> development phase are documented in detail. Last updated: 2026-10-12

## 1. Overview

Project Nebula uses PostgreSQL hosted on Supabase.

The database stores persistent application data.

### Initial Scope

The initial database contains one table:

- `products`

Future tables for carts, orders, payments, hotels and experiences will be
designed when needed.

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

The `products` table stores items available in the fictional Puzzini Shop.

Each row represents one product.

### SQL Schema

```sql
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name TEXT NOT NULL,

    description TEXT NOT NULL DEFAULT '',

    price_pawstars INTEGER NOT NULL
        CHECK (price_pawstars >= 0),

    category TEXT NOT NULL,

    stock_quantity INTEGER NOT NULL DEFAULT 0
        CHECK (stock_quantity >= 0),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Columns

| Column           | Type        | Nullable | Default  | Purpose             |
| ---------------- | ----------- | -------- | -------- | ------------------- |
| `id`             | BIGINT      | No       | Identity | Unique identifier   |
| `name`           | TEXT        | No       | None     | Product name        |
| `description`    | TEXT        | No       | `''`     | Product description |
| `price_pawstars` | INTEGER     | No       | None     | Price in Pawstars   |
| `category`       | TEXT        | No       | None     | Product category    |
| `stock_quantity` | INTEGER     | No       | 0        | Available units     |
| `is_active`      | BOOLEAN     | No       | TRUE     | Product visibility  |
| `created_at`     | TIMESTAMPTZ | No       | now()    | Creation timestamp  |

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

However, `NOT NULL` does not reject empty strings such as `''`.

The backend will validate name content.

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

### Data Types

`BIGINT`

- Signed 64-bit integer.
- Used for product IDs.

`INTEGER`

- Signed 32-bit integer.
- Used for prices and stock quantities.

`TEXT`

- Variable-length text.
- Used for names, descriptions and categories.

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

Initial sample products will be inserted with SQL.

Example:

```sql
INSERT INTO products (
    name,
    description,
    price_pawstars,
    category,
    stock_quantity
)
VALUES (
    'Sphynx Sweater',
    'Warm, because they are not.',
    3900,
    'clothing',
    14
);
```

PostgreSQL automatically supplies:

- `id`
- `is_active`
- `created_at`

More sample products will be added during catalog development.

## 7. Database Access

The Express backend will communicate with PostgreSQL using SQL.

The initial plan is to use the Node.js `pg` library.

No ORM will be used initially.

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

The `pg` library commonly returns BIGINT values as strings.

ID serialization and validation must remain consistent with the API contract.

### Transactions

Transactions will be introduced when several database operations must succeed or
fail together.

They will be especially important for:

- Order creation
- Stock updates
- Simulated checkout

## 8. Database Migrations

Schema changes will be tracked in versioned SQL files.

Proposed directory:

`backend/db/migrations/`

First migration:

`001_create_products.sql`

This migration will contain the executable CREATE TABLE and CREATE INDEX
statements.

### Documentation vs Migrations

`database-design.md`:

- Describes the intended schema.
- Explains data types and constraints.
- Documents design decisions.
- Discusses indexes and trade-offs.

Migration files:

- Contain executable SQL.
- Apply schema changes to PostgreSQL.
- Track database structure over time.

The migration process will be selected before the first migration is applied.

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

## 10. Future Database Expansion

Future e-commerce tables may include:

- `users`
- `carts`
- `cart_items`
- `orders`
- `order_items`
- `payments`

Hotel and experience functionality will require additional tables and
relationships.

Their database structures have not yet been designed.

Foreign keys, transactions and business constraints will be defined as the
corresponding features are implemented.

---

**Document status:** Initial database design draft.

No migrations have been applied yet.
