# API Design — Project Nebula

> API reference and current implementation status.
> Detailed database schema: [Database Design](./database-design.md). Detailed cart rules: [Shopping Cart Design](./shopping-cart-design.md).

## 1. Overview

Project Nebula is a fictional e-commerce platform. Orders and payments are simulated. The currency is the **Pawstar (PWS)**; prices are whole integers, with no fractional units or currency conversion.

| Layer    | Technology                               | Responsibility                       |
| -------- | ---------------------------------------- | ------------------------------------ |
| Frontend | Next.js, React, TypeScript               | UI and HTTP requests                 |
| Backend  | Node.js, Express, TypeScript             | REST API, validation, business logic |
| Database | PostgreSQL (Neon), plain SQL             | Data persistence and constraints     |
| Testing  | Vitest, Supertest, Neon `testing` branch | Isolated and real-database tests     |

The frontend and backend are separate. Only Express accesses PostgreSQL; database credentials must never reach the frontend. Local development uses frontend `http://localhost:3000` and API `http://localhost:4000`.

**Implemented:** product catalog API and frontend; product detail pages; guest cart backend (GET, POST, PATCH, DELETE); shopping cart interface; checkout API and frontend; order persistence; simulated payment status; order confirmation email attempt.

**Remaining verification:** complete browser-to-backend integration and end-to-end shopping workflows.

Hotels and Experiences are explicitly outside the current scope.

## 2. API Conventions

- Base path: `/api`. Request and response bodies use JSON where applicable.
- Resource fields use `snake_case`; pagination metadata uses `camelCase` (`totalPages`).
- Product IDs are positive PostgreSQL `BIGINT` values represented as strings in JSON.
- Prices are integer Pawstars (`price_pawstars`), not floating-point amounts.
- Return structured errors, never database credentials, stack traces or other internal details.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input."
  }
}
```

Typical HTTP statuses: `200` success, `201` created, `204` no response body where applicable, `400` invalid input, `401` unauthenticated for future protected endpoints, `403` forbidden/origin rejected, `404` not found, `409` business conflict, `415` unsupported content type, `429` rate-limited if enabled, `500` unexpected error. Individual endpoint sections specify actual implemented codes.

### Pagination and sorting

List endpoints filter first, then sort, then paginate. Defaults are `page=1`, `limit=20`; `limit` must be 1–100 and `page` a positive decimal integer. Invalid values, unsafe offsets, and unsupported sort options return `400`. SQL offset is `(page - 1) * limit`; sorting uses `id` as a deterministic tiebreaker.

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

`total` counts all matching records before pagination; `totalPages` is `ceil(total / limit)`, or zero when no results match. Valid pages beyond the end return `200` with `items: []`.

## 3. Data and Product Visibility

Current tables:

- `products`
- `carts`
- `cart_items`
- `orders`
- `order_items`

SQL migrations define the schema, constraints and indexes; see [Database Design](./database-design.md).

Public product endpoints show only `is_active = TRUE` products. Inactive products are excluded from lists and return `404` on the public detail endpoint. Already-added cart items remain visible even if their product later becomes inactive or out of stock; they are flagged unavailable.

## 4. Products API — Implemented

### GET `/api/products`

Returns a paginated list of active products. All filters combine with AND.

| Query parameter          | Default   | Behavior                                        |
| ------------------------ | --------- | ----------------------------------------------- |
| `category`               | none      | Exact category match after trimming             |
| `q`                      | none      | Case-insensitive name search                    |
| `min_price`, `max_price` | none      | Inclusive Pawstar price range                   |
| `sort`                   | `newest`  | `newest`, `price_asc`, `price_desc`, `name_asc` |
| `page`, `limit`          | `1`, `20` | Pagination rules above                          |

Sort order:

| Value        | SQL ordering                   |
| ------------ | ------------------------------ |
| `newest`     | `created_at DESC, id DESC`     |
| `price_asc`  | `price_pawstars ASC, id ASC`   |
| `price_desc` | `price_pawstars DESC, id DESC` |
| `name_asc`   | `name ASC, id ASC`             |

Example request:

`GET /api/products?category=clothing&sort=price_asc&page=1&limit=20`

A category or search with no results returns `200` and an empty `items` array.

The implemented catalog frontend preserves `category`, `q`, `sort`, and `page` in URL parameters. See [Frontend Catalog Design](./frontend-catalog-design.md).

### GET `/api/products/:id`

Returns one active product using the product object shape shown above, without pagination metadata.

Responses: `200` product; `400 INVALID_PRODUCT_ID`; `404 PRODUCT_NOT_FOUND`; `500 INTERNAL_SERVER_ERROR`.

## 5. Guest Shopping Cart API — Implemented

No login is needed. Cart content lives in PostgreSQL; the browser holds a random `cart_token` in an **HttpOnly**, **SameSite=Lax** cookie (`Secure` in production). Only the token's SHA-256 hash is stored in PostgreSQL. Without the cookie, another browser/device cannot retrieve the guest cart.

| Method   | Endpoint                     | Purpose                              | Success                             |
| -------- | ---------------------------- | ------------------------------------ | ----------------------------------- |
| `GET`    | `/api/cart`                  | Read cart                            | `200`                               |
| `POST`   | `/api/cart/items`            | Add an item or increase its quantity | `201` new cart, `200` existing cart |
| `PATCH`  | `/api/cart/items/:productId` | Replace existing item quantity       | `200`                               |
| `DELETE` | `/api/cart/items/:productId` | Remove one item                      | `200`                               |

Successful operations return the updated cart.

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

- Missing, malformed, unknown or expired token returns `200` with an empty cart.
- Does not create a cart or renew expiration.
- Existing items remain visible and indicate availability even when a product becomes inactive or stock is insufficient.
- Unexpected failures return `500 INTERNAL_SERVER_ERROR`.

### POST `/api/cart/items`

Requires `Content-Type: application/json` and a trusted `Origin`.

```json
{
  "product_id": "1",
  "quantity": 2
}
```

- Request body must have exactly those two fields.
- Product ID must be a valid positive BIGINT string.
- Quantity must be an integer from 1 to 20.
- A missing or expired cart is created only after a valid addition.
- An existing item's quantity is increased, not replaced.
- Product must exist, be active, and have enough stock.
- Stock is checked but not reserved or reduced.
- Successful modification renews the seven-day cart expiration.

### PATCH `/api/cart/items/:productId`

Requires a valid existing cart cookie, trusted `Origin`, and JSON body:

```json
{
  "quantity": 2
}
```

- Replaces the quantity; it does not add to it or create a new item.
- Increasing quantity requires an active product and sufficient stock.
- Reducing an existing item is allowed even if the product has become inactive or stock has dropped.
- Successful modification renews the seven-day expiration.
- To remove an item, use DELETE; `quantity: 0` is invalid.

### DELETE `/api/cart/items/:productId`

Requires a valid existing cart cookie and trusted `Origin`.

- Removes only the selected cart item, including when the product is unavailable.
- Deleting the last item leaves a valid empty cart, not a deleted cart record.
- Successful modification renews the seven-day expiration.

### Cart lifecycle and safety

- A cart expires after seven days without a successful modification.
- GET does not extend expiration; successful POST, PATCH and DELETE do.
- Database modifications use transactions and cart row locks.
- Failed modifications roll back and do not renew the cookie.
- CORS allows the configured frontend origin; state-changing requests require its trusted `Origin` as CSRF protection.
- Guest carts are not automatically shared across devices.

For schema and lifecycle details, see [Shopping Cart Design](./shopping-cart-design.md).

## 6. Checkout API — Implemented

### POST `/api/cart/checkout`

Creates an order from the existing guest cart.

Checkout uses the existing HttpOnly cart cookie. No customer account is required.

The request must use JSON.

Required fields:

| Field            | Description            |
| ---------------- | ---------------------- |
| `customer_email` | Customer email address |
| `first_name`     | Customer first name    |
| `last_name`      | Customer last name     |
| `address_line1`  | Main shipping address  |
| `city`           | Shipping city          |
| `postal_code`    | Shipping postal code   |
| `country`        | Shipping country       |

Optional fields:

- `address_line2`
- `phone`

Unsupported fields are rejected. The client must not submit product prices or an authoritative total.

### Checkout process

The backend:

1. Validates the request and customer email.
2. Resolves the cart through the existing cookie.
3. Locks the cart row and checks its expiration.
4. Loads cart items and locks the relevant product rows.
5. Rejects an empty cart.
6. Checks that products are active and sufficiently stocked.
7. Reads prices from PostgreSQL and calculates the total.
8. Inserts the order and item snapshots.
9. Decrements product stock.
10. Deletes the cart items.
11. Renews the cart expiration.
12. Commits the transaction.
13. Attempts to send the confirmation email after commit.

Order creation, stock updates and cart item deletion are part of the same database transaction.

If a database operation fails, the transaction is rolled back. The cart record and cookie are retained after successful checkout; only its items are deleted.

### Successful response

Returns `201 Created` with an `order` object containing:

- `order_number`
- `customer_email`
- `total_pawstars`
- `payment_status`
- `created_at`
- `items`

Each item contains:

- `product_name`
- `quantity`
- `unit_price_pawstars`
- `line_total_pawstars`

The initial order status is `confirmed`. The payment status is `simulated`.

### Payment behavior

Payment is simulated.

- No payment provider is called.
- No card information is collected.
- No money is charged.
- The order records `payment_status = 'simulated'`.

### Email confirmation

After the database transaction commits, the backend attempts to send an order confirmation email using Resend.

Backend environment variables:

- `RESEND_API_KEY`
- `EMAIL_FROM`

Email delivery failure does not roll back the order. The failure is logged separately.

See [Payment Flow](./payment-flow.md) for the checkout process.

## 7. Testing and CI

- **Unit / isolated HTTP tests:** Vitest and Supertest test validation, API status codes, cookie behavior, and repository branches using mocks. Mocked repository tests do not prove SQL behavior against PostgreSQL.
- **Integration tests:** dedicated Neon `testing` database for real SQL and Supertest → Express → PostgreSQL.
- **Frontend component tests:** Vitest and React Testing Library test UI behavior and mocked API responses.
- **End-to-end verification:** verify complete browser workflows across the catalog, product detail, cart and checkout interfaces.

From `backend` on Windows:

```powershell
npm.cmd run build
npx.cmd vitest run --coverage
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
```

`TEST_DATABASE_URL` must point to the Neon testing branch, never the application/production database. GitHub Actions uses a dedicated `TEST_DATABASE_URL` secret for integration tests.

## 8. Roadmap and Open Decisions

| Area                                               | Status / next work                |
| -------------------------------------------------- | --------------------------------- |
| Product catalog API, listing, details and frontend | Implemented                       |
| Guest cart GET, POST, PATCH, DELETE backend        | Implemented and tested            |
| Shopping cart frontend and components              | Implemented                       |
| Checkout API and order persistence                 | Implemented                       |
| Shipping details and order item snapshots          | Implemented                       |
| Simulated payment status                           | Implemented                       |
| Resend confirmation email attempt                  | Implemented                       |
| Real browser-to-backend shopping workflow          | Verify                            |
| Complete end-to-end tests                          | Planned                           |
| Real payment processing                            | Out of scope                      |
| Authentication                                     | Decide if required                |
| Hotels and Experiences                             | Deferred, separate future modules |

Open decisions include whether customer accounts are needed, order cancellation and status transitions, real payment processing in a future version, and an administrative API.

## 9. Decision Summary

- **2026-10-12:** Start with product e-commerce; defer Hotels/Experiences. Use a separate Express backend, PostgreSQL without an ORM, integer Pawstars, server-side pagination and deterministic sorting. Simulate payments only.
- **2026-10-12:** Keep database schema documentation in a separate file.
- **2026-10-15:** Product catalog API implemented; separate Neon testing branch and Vitest configurations added.
- **2026-10-25:** Guest shopping cart backend endpoints GET/POST/PATCH/DELETE implemented and exercised by isolated and PostgreSQL integration tests.
- **2026-10-27:** Shopping cart frontend components and interface implemented.
- **2026-10-31:** Checkout endpoint, order persistence, shipping details, simulated payment status and checkout frontend implemented.

---

**Document status:** Product catalog, guest cart and simulated checkout API documented. Real payment processing is not implemented.
