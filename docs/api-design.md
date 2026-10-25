# API Design — Project Nebula

> API reference and current implementation status. Updated: 2026-10-25.
> Detailed database schema: [Database Design](./database-design.md). Detailed cart rules: [Shopping Cart Design](./shopping-cart-design.md).

## 1. Overview

Project Nebula is a fictional e-commerce platform for products from a planet inhabited by hairless cats. Orders and payments will be simulated. The currency is the **Pawstar (PWS)**; prices are whole integers, with no fractional units or currency conversion.

| Layer    | Technology                               | Responsibility                       |
| -------- | ---------------------------------------- | ------------------------------------ |
| Frontend | Next.js, React, TypeScript               | UI and HTTP requests                 |
| Backend  | Node.js, Express, TypeScript             | REST API, validation, business logic |
| Database | PostgreSQL (Neon), plain SQL             | Data persistence and constraints     |
| Testing  | Vitest, Supertest, Neon `testing` branch | Isolated and real-database tests     |

The frontend and backend are separate. Only Express accesses PostgreSQL; database credentials must never reach the frontend. Local development uses frontend `http://localhost:3000` and API `http://localhost:4000`.

**Implemented:** product catalog API and frontend; guest cart backend (GET, POST, PATCH, DELETE). **Planned:** cart frontend, orders, inventory checkout, simulated payments and any authentication required later. Hotels and Experiences are explicitly outside the current scope.

## 2. API Conventions

- Base path: `/api`. Request and response bodies use JSON where applicable.
- Resource fields use `snake_case`; pagination metadata uses `camelCase` (`totalPages`).
- Product IDs are positive PostgreSQL `BIGINT` values represented as **strings** in JSON, avoiding JavaScript precision loss. Valid IDs cannot exceed `9223372036854775807`.
- Prices are integer Pawstars (`price_pawstars`), not floating-point amounts.
- Return structured errors, never database credentials, stack traces or other internal details:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input."
  }
}
```

Typical HTTP statuses: `200` success, `201` created, `204` no response body (where applicable), `400` invalid input, `401` unauthenticated (future protected endpoints), `403` forbidden/origin rejected, `404` not found, `409` business conflict, `415` unsupported content type, `429` rate-limited (future), `500` unexpected error. Individual endpoint sections specify actual implemented codes.

### Pagination and sorting

List endpoints filter first, then sort, then paginate. Defaults are `page=1`, `limit=20`; `limit` must be 1–100 and `page` a positive decimal integer. Invalid values, unsafe offsets, and unsupported sort options return `400`. SQL offset is `(page - 1) * limit`; sorting uses `id` as a deterministic tiebreaker. Concurrent inserts/deletes may still shift pages.

Standard list format:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

`total` counts all matching records before pagination; `totalPages` is `ceil(total / limit)`, or zero when no results match. Valid pages beyond the end return `200` with `items: []` rather than an error.

## 3. Data and Product Visibility

Current tables: `products`, `carts`, and `cart_items`. SQL migrations define the schema, constraints and indexes; see [Database Design](./database-design.md).

Public product endpoints show only `is_active = TRUE` products. Inactive products are excluded from lists and return `404` on the public detail endpoint. Already-added cart items remain visible even if their product later becomes inactive or out of stock; they are flagged unavailable.

## 4. Products API — Implemented

### GET `/api/products`

Returns a paginated list of active products. All filters combine with **AND**.

| Query parameter          | Default   | Behavior                                                                           |
| ------------------------ | --------- | ---------------------------------------------------------------------------------- |
| `category`               | none      | Exact category match after trimming                                                |
| `q`                      | none      | Case-insensitive name search; max 100 trimmed characters                           |
| `min_price`, `max_price` | none      | Inclusive Pawstar price range; nonnegative integers, at most 2147483647, min ≤ max |
| `sort`                   | `newest`  | `newest`, `price_asc`, `price_desc`, `name_asc`                                    |
| `page`, `limit`          | `1`, `20` | Pagination rules above                                                             |

Sort order:

| Value        | SQL ordering                   |
| ------------ | ------------------------------ |
| `newest`     | `created_at DESC, id DESC`     |
| `price_asc`  | `price_pawstars ASC, id ASC`   |
| `price_desc` | `price_pawstars DESC, id DESC` |
| `name_asc`   | `name ASC, id ASC`             |

Unknown or repeated parameters are rejected (`400`). Empty `category` and `q` act as absent filters; whitespace is trimmed. Numeric values must be valid decimal integers in supported safe ranges. Invalid inputs are rejected, not silently repaired. Parameterized SQL handles filters, and sort expressions come from a fixed allowlist.

Example request:

`GET /api/products?category=clothing&sort=price_asc&page=1&limit=20`

Example `200` response (illustrative values):

```json
{
  "items": [
    {
      "id": "1",
      "name": "Sphynx Sweater",
      "description": "Warm, because they are not.",
      "price_pawstars": 3900,
      "category": "clothing",
      "stock_quantity": 14,
      "is_active": true,
      "created_at": "2026-10-12T10:00:00.000Z",
      "slug": "sphynx-sweater",
      "image_url": null
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

A category or search with no results returns `200`, `items: []`, `total: 0`, `totalPages: 0`. A page beyond the end likewise returns `200` with an empty `items` array while preserving the requested page and actual totals.

Errors: `400 VALIDATION_ERROR` (unknown/repeated parameters or invalid search), `400 INVALID_PAGINATION`, `400 INVALID_SORT`, `400 INVALID_PRICE_RANGE`, `500 INTERNAL_SERVER_ERROR`.

The implemented catalog frontend preserves `category`, `q`, `sort`, and `page` in URL parameters; changing filters or sorting resets the page to 1. It requests 20 products per page, validates URL inputs, uses `total` for result counts, and offers a clear-filters action for empty results. The existing eight categories are supported. See [Frontend Catalog Design](./frontend-catalog-design.md).

### GET `/api/products/:id`

Returns one active product using the product object shape shown above (without pagination metadata). The path ID must be a positive decimal integer **without leading zeros**, within signed PostgreSQL `BIGINT` range.

Responses: `200` product; `400 INVALID_PRODUCT_ID` for invalid ID; `404 PRODUCT_NOT_FOUND` for missing or inactive product; `500 INTERNAL_SERVER_ERROR` for unexpected failure.

## 5. Guest Shopping Cart API — Implemented (Backend)

No login is needed. Cart content lives in PostgreSQL; the browser holds a random `cart_token` in an **HttpOnly**, **SameSite=Lax** cookie (`Secure` in production). Only the token's SHA-256 hash is stored in PostgreSQL. Without the cookie, another browser/device cannot retrieve the guest cart.

| Method   | Endpoint                     | Purpose                              | Success                             |
| -------- | ---------------------------- | ------------------------------------ | ----------------------------------- |
| `GET`    | `/api/cart`                  | Read cart                            | `200`                               |
| `POST`   | `/api/cart/items`            | Add an item or increase its quantity | `201` new cart, `200` existing cart |
| `PATCH`  | `/api/cart/items/:productId` | Replace existing item quantity       | `200`                               |
| `DELETE` | `/api/cart/items/:productId` | Remove one item                      | `200`                               |

Successful operations return the **updated cart** in this shape (example values):

```json
{
  "items": [
    {
      "product_id": "1",
      "name": "Moonwarm Bodysuit",
      "image_url": null,
      "price_pawstars": 3900,
      "quantity": 2,
      "subtotal_pawstars": 7800,
      "is_available": true
    }
  ],
  "total_pawstars": 7800
}
```

An empty cart returns `{"items":[],"total_pawstars":0}`. Backend prices and totals always reflect current database prices; frontend-provided prices are not trusted.

### GET `/api/cart`

- Missing, malformed, unknown or expired token → `200` with an empty cart.
- Does not create a cart or renew expiration.
- Existing items remain visible and indicate availability even when a product becomes inactive or stock is insufficient.
- Unexpected failures → `500 INTERNAL_SERVER_ERROR`.

### POST `/api/cart/items`

Requires `Content-Type: application/json` and a trusted `Origin`.

```json
{ "product_id": "1", "quantity": 2 }
```

- Request body must have **exactly** those two fields: valid positive BIGINT ID string and integer quantity 1–20.
- A missing/expired cart is created only after a valid addition. An existing item's quantity is **increased**, not replaced.
- Product must exist, be active, and have enough stock for the new total quantity, which must remain ≤20.
- Success creates/renews the cookie and seven-day cart expiration. Stock is checked but not reserved or reduced.
- Responses: `201` new cart, `200` existing cart; `400 VALIDATION_ERROR`, `403 FORBIDDEN_ORIGIN`, `404 PRODUCT_NOT_FOUND`, `409 QUANTITY_LIMIT_EXCEEDED` or `INSUFFICIENT_STOCK`, `415 UNSUPPORTED_MEDIA_TYPE`, `500 INTERNAL_SERVER_ERROR`.

### PATCH `/api/cart/items/:productId`

Requires a valid existing cart cookie, trusted `Origin`, and JSON body:

```json
{ "quantity": 2 }
```

- `productId` must be a valid positive BIGINT path ID. Body must contain **only** integer `quantity` from 1 to 20.
- **Replaces** the quantity; it does not add to it or create a new item.
- Increasing an item's quantity requires an active product and sufficient stock. Reducing an existing item is allowed even if the product has become inactive or stock has dropped.
- Success → `200` updated cart, renewed cookie and seven-day expiration.
- Errors: `400 VALIDATION_ERROR`, `403 FORBIDDEN_ORIGIN`, `404 CART_NOT_FOUND` or `CART_ITEM_NOT_FOUND`, `409 PRODUCT_UNAVAILABLE` or `INSUFFICIENT_STOCK`, `415 UNSUPPORTED_MEDIA_TYPE`, `500 INTERNAL_SERVER_ERROR`.
- To remove an item, use DELETE; `quantity: 0` is invalid.

### DELETE `/api/cart/items/:productId`

Requires a valid existing cart cookie and trusted `Origin`. No JSON request body is required.

- Removes **only** the selected cart item, including when the product is unavailable. No stock check is needed.
- Deleting the last item leaves a valid **empty cart**, not a deleted cart record.
- Success → `200` updated cart, renewed cookie and seven-day expiration.
- Errors: `400 VALIDATION_ERROR` (invalid ID), `403 FORBIDDEN_ORIGIN`, `404 CART_NOT_FOUND` or `CART_ITEM_NOT_FOUND`, `500 INTERNAL_SERVER_ERROR`.

### Cart lifecycle and safety

- A cart expires after **seven days without a successful modification**. GET does not extend it; successful POST, PATCH and DELETE do.
- Database modifications use transactions and cart row locks to coordinate concurrent requests. Failed modifications roll back and do not renew the cookie.
- The API validates data on the backend. SQL is parameterized. CORS allows the configured frontend origin; state-changing requests require its trusted `Origin` as CSRF protection.
- The cookie belongs to the browser; guest carts are **not automatically shared across devices**.

For schema, reasoning and lifecycle details, use [Shopping Cart Design](./shopping-cart-design.md), rather than repeating them here.

## 6. Orders, Checkout and Authentication — Planned

Orders will use backend-calculated totals, re-check stock at checkout, and prevent overselling under concurrency. Customers will review a cart, create an order, complete a **simulated** payment, and view order status. Order transitions, cancellation rules, and payment states still need design.

Authentication endpoints have **not** been defined. Before protected features are built, decide whether accounts are needed, which provider/session model to use, per-user authorization and administrative permissions. Guest cart support already works without accounts.

## 7. Testing and CI

- **Unit / isolated HTTP tests:** Vitest and Supertest test validation, API status codes, cookie behavior, and repository branches using mocks. Mocked repository tests do **not** prove SQL behavior against PostgreSQL.
- **Integration tests:** dedicated Neon `testing` database for real SQL and Supertest → Express → PostgreSQL. Cart tests check CRUD behavior, expiration, stock rules, transactions and selected concurrent operations.
- **Future E2E tests:** complete browser workflows after the relevant frontend screens exist.

From `backend` on Windows PowerShell:

```powershell
npm.cmd run build
npx.cmd vitest run --coverage
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
```

`TEST_DATABASE_URL` must point to the **Neon testing branch**, never the application/production database. GitHub Actions uses a dedicated `TEST_DATABASE_URL` secret to run the build, isolated tests and integration tests. Coverage measures executed paths, not proof that all behaviors are correct.

## 8. Roadmap and Open Decisions

| Area                                                         | Status / next work                |
| ------------------------------------------------------------ | --------------------------------- |
| Product catalog API, listing, details and frontend           | Implemented                       |
| Guest cart GET, POST, PATCH, DELETE backend                  | Implemented and tested            |
| Cart frontend and complete cart user flow                    | Planned                           |
| Additional cart integration edge cases and end-to-end checks | Review before merging             |
| Authentication                                               | Decide if required                |
| Orders, stock management and simulated checkout              | Planned                           |
| Full e-commerce E2E coverage                                 | Planned                           |
| Hotels and Experiences                                       | Deferred, separate future modules |

Open decisions: whether to require customer accounts; authentication and authorization approach; inventory reservation during checkout; order cancellation and status transitions; simulated payment states; administrative API; product image storage. Product categories are already defined; the `image_url` field exists but an image-storage solution is not implemented.

## 9. Decision Summary

- **2026-10-12:** Start with product e-commerce; defer Hotels/Experiences. Use a separate Express backend, PostgreSQL without an ORM, integer Pawstars, server-side pagination, predictable validation and deterministic sorting. Return `200` for valid empty result sets and simulate payments only.
- **2026-10-12:** Keep database schema documentation in a separate file to avoid duplication.
- **2026-10-15:** Product catalog API implemented; separate Neon testing branch and Vitest configurations added.
- **2026-10-25:** Guest shopping cart backend endpoints GET/POST/PATCH/DELETE implemented and exercised by isolated and PostgreSQL integration tests. Cart frontend and checkout remain future work.

---

**Document status:** Current API contracts for products and the guest cart; planned features are intentionally high-level.
