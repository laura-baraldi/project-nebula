# API Design: Project Nebula

> Living document. Only what is decided or being built right now is described in
> detail. Future features are documented when their development begins. Last
> updated: 2026-10-15

## 1. Overview

Project Nebula is a fictional full-stack e-commerce platform selling products
from a planet inhabited by hairless cats.

The project exists to practice API design, backend development, SQL, testing and
frontend-backend communication.

All purchases and payments are simulated.

The planet's currency is the **Pawstar** (plural: Pawstars), abbreviated as PWS.

### Technology Stack

| Layer       | Choice                         | Why                                                  |
| ----------- | ------------------------------ | ---------------------------------------------------- |
| Frontend    | Next.js + React + TypeScript   | Routing, React practice and server-rendered pages    |
| Backend     | Node.js + Express + TypeScript | Practice designing REST API contracts                |
| Database    | PostgreSQL (Neon)              | Practice SQL and relational databases without an ORM |
| Development | Local only                     | Focus on learning rather than deployment             |

- Frontend: `http://localhost:3000` (planned)
- Backend: `http://localhost:4000`

### Architecture Rules

- Frontend and backend are separate applications.
- The frontend communicates with Express through HTTP.
- Next.js does not query PostgreSQL directly.
- Express handles input validation and business logic.
- PostgreSQL enforces data integrity constraints.
- SQL queries are written without an ORM initially.
- Database credentials are never exposed to the frontend.

## 2. Project Scope

### Initial Version: E-commerce

The application will support:

- Product catalog
- Product details
- Product categories
- Search and filtering
- Sorting and pagination
- Shopping cart
- Stock availability
- Orders
- Simulated checkout and payments

The product catalog backend API is implemented. The remaining e-commerce
features will be developed incrementally.

### Future Features

Not included in the initial version:

- Hotel catalog and room reservations
- Experience catalog and bookings
- Date-based availability
- Unified cart for different resource types

These features will be designed separately when needed.

## 3. API Conventions

### Base Path

`/api`

Requests and responses use JSON.

### Naming

- Resource fields use `snake_case`.
- Pagination metadata uses `camelCase`.
- Resource IDs are positive integers stored as PostgreSQL `BIGINT`.
- Product IDs are returned as JSON strings to avoid JavaScript precision loss.

### Currency

All prices are expressed in whole Pawstars (PWS).

- No cents.
- No fractional units.
- No floating-point prices.

Example:

```json
{
  "price_pawstars": 3900
}
```

Only one currency is supported initially.

No currency column is required.

### Pagination

List endpoints use server-side pagination.

| Parameter | Default           | Validation                |
| --------- | ----------------- | ------------------------- |
| `page`    | 1                 | Positive decimal integer  |
| `limit`   | 20                | Integer between 1 and 100 |
| `sort`    | Endpoint-specific | Allowed values only       |

The backend applies operations in this order:

1. Filtering
2. Sorting
3. Pagination

SQL offset:

`(page - 1) * limit`

Each sorting method includes `id` as a unique tiebreaker.

This provides deterministic ordering for an unchanged dataset, but does not
prevent page shifts if records are inserted or deleted between requests.

Invalid pagination parameters return HTTP 400.

Page and offset values must remain within JavaScript's safe integer range.

### Standard List Response

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

- `items`: records for the requested page.
- `page`: requested page number.
- `limit`: maximum records per page.
- `total`: matching records before pagination.
- `totalPages`: `ceil(total / limit)`.

When `total` is zero, `totalPages` is zero.

### Standard Error Response

Implemented endpoints return errors using this structure:

```json
{
  "error": {
    "code": "INVALID_PAGINATION",
    "message": "Page must be a positive integer and limit must be between 1 and 100."
  }
}
```

### HTTP Status Codes

Successful responses:

- `200 OK`: successful retrieval or update.
- `201 Created`: created resource.
- `204 No Content`: successful operation without a response body.

Error responses:

| HTTP Status | Application Code      | Meaning                           |
| ----------- | --------------------- | --------------------------------- |
| 400         | VALIDATION_ERROR      | Unknown or repeated parameters    |
| 400         | INVALID_PAGINATION    | Invalid page, limit or offset     |
| 400         | INVALID_SORT          | Invalid sorting option            |
| 400         | INVALID_PRICE_RANGE   | Invalid price range               |
| 400         | INVALID_PRODUCT_ID    | Invalid product ID                |
| 401         | UNAUTHORIZED          | Missing or invalid authentication |
| 403         | FORBIDDEN             | Insufficient permissions          |
| 404         | PRODUCT_NOT_FOUND     | Missing or inactive product       |
| 409         | CONFLICT              | Business rule conflict            |
| 429         | RATE_LIMITED          | Too many requests                 |
| 500         | INTERNAL_SERVER_ERROR | Unexpected server error           |

Only the codes relevant to the currently implemented product endpoints are
implemented. Authentication, conflicts and rate limiting are planned for later
features.

Application error codes are custom identifiers returned in JSON, not HTTP reason
phrases.

Unexpected errors must not expose stack traces, credentials or other sensitive
internal information.

### Resource Visibility

Public product endpoints return only products where `is_active = TRUE`.

Inactive products are excluded from public lists.

Requesting an inactive product through the public detail endpoint returns
`404 Not Found`.

Future administrative endpoints may follow different rules.

## 4. Database Design

The database schema is documented separately:

[Database Design](./database-design.md)

The initial database contains one table:

- `products`

The database document describes:

- Column names and data types
- Primary keys
- Constraints and default values
- Indexes
- Database design decisions

Schema changes are managed through SQL migration files.

The product table and its initial migrations have been applied to Neon.

## 5. Products API

The following endpoints are implemented.

### GET /api/products

Retrieve a paginated list of active products.

#### Query Parameters

| Parameter   | Default  | Description                         |
| ----------- | -------- | ----------------------------------- |
| `category`  | none     | Exact category match after trimming |
| `q`         | none     | Case-insensitive name search        |
| `min_price` | none     | Minimum price in Pawstars           |
| `max_price` | none     | Maximum price in Pawstars           |
| `sort`      | `newest` | Sorting method                      |
| `page`      | 1        | Page number                         |
| `limit`     | 20       | Results per page                    |

Multiple filters are combined using AND.

Price filters are inclusive.

#### Allowed Sorting Values

| Value        | SQL ORDER BY                   |
| ------------ | ------------------------------ |
| `newest`     | `created_at DESC, id DESC`     |
| `price_asc`  | `price_pawstars ASC, id ASC`   |
| `price_desc` | `price_pawstars DESC, id DESC` |
| `name_asc`   | `name ASC, id ASC`             |

Default: `newest`.

Filtering, sorting and pagination are performed by PostgreSQL.

#### Example Request

`GET /api/products?category=clothing&sort=price_asc&page=1&limit=20`

#### Success Response: 200 OK

The following example is illustrative. Actual product values depend on the
database contents.

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
    },
    {
      "id": "2",
      "name": "Cosmic Blanket",
      "description": "A warm blanket for interstellar naps.",
      "price_pawstars": 4500,
      "category": "clothing",
      "stock_quantity": 8,
      "is_active": true,
      "created_at": "2026-10-12T10:00:00.000Z",
      "slug": "cosmic-blanket",
      "image_url": null
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 2,
  "totalPages": 1
}
```

The current API selects all product columns from PostgreSQL.

#### Validation

- `page` must be a positive decimal integer.
- `limit` must be an integer between 1 and 100.
- `min_price` and `max_price` must be non-negative integers.
- Price values cannot exceed PostgreSQL INTEGER's maximum of 2147483647.
- `min_price` cannot exceed `max_price`.
- `sort` must be an allowed value.
- Unknown query parameters return `400`.
- Repeated query parameters return `400`.
- `q` must contain at most 100 characters after trimming.
- Leading and trailing whitespace in `q` and `category` is trimmed.
- Empty `q` and `category` values are treated as absent filters.
- Numeric parameters must contain valid decimal integer representations.
- Parsed numeric values must be within supported safe ranges.
- Invalid inputs are rejected rather than silently corrected.

#### Errors

- `400 VALIDATION_ERROR`: unknown or repeated parameters, or invalid search length.
- `400 INVALID_PAGINATION`: invalid page, limit or offset.
- `400 INVALID_SORT`: unsupported sorting option.
- `400 INVALID_PRICE_RANGE`: invalid price filters.
- `500 INTERNAL_SERVER_ERROR`: unexpected server error.

#### Business Rules

- Only active products are returned.
- Filters are combined using AND.
- Filtering happens before sorting and pagination.
- SQL offset is calculated as `(page - 1) * limit`.
- `total` counts matching products before pagination.
- `totalPages` is calculated as `ceil(total / limit)`.
- A valid page beyond available results returns `200` with an empty `items`
  array.
- A category or search with no matches returns `200` with an empty `items`
  array.
- The frontend resets `page` to 1 when filters or sorting change.
- The frontend keeps filters, sorting and page in URL query parameters.
- User-provided values are passed through parameterized SQL queries.
- Sort values are mapped to a fixed allowlist of SQL ordering expressions.

The two frontend-specific rules above are planned frontend behavior.

#### Example: No Matching Products

Request:

`GET /api/products?category=nonexistent`

Response: `200 OK`

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

#### Example: Page Beyond Available Results

Request:

`GET /api/products?page=50&limit=20`

Assuming 35 products match:

Response: `200 OK`

```json
{
  "items": [],
  "page": 50,
  "limit": 20,
  "total": 35,
  "totalPages": 2
}
```

#### Frontend Catalog Behavior — Planned

The product catalog frontend uses URL query parameters to preserve filtering, sorting and pagination state.

- Category filtering supports the eight existing product categories.
- Selecting "All Products" removes the `category` parameter.
- Product search uses the existing `q` parameter.
- Sorting uses the existing values: `newest`, `price_asc`, `price_desc` and `name_asc`.
- The frontend requests 20 products per page.
- Changing category, search query or sorting resets pagination to page 1.
- Pagination preserves active filters and sorting.
- Invalid URL parameters are handled before constructing API requests.
- Empty results display a message and an option to clear filters.
- The result count comes from the API's `total` field.

Example:

`/products?category=toys&q=moon&sort=price_asc&page=1`

Detailed UI decisions are documented in [Frontend Catalog Design](./frontend-catalog-design.md).

### GET /api/products/:id

Retrieve a single active product.

#### Path Parameters

- `id`: required positive decimal integer without leading zeroes.
- IDs must fit within PostgreSQL's signed BIGINT range.

#### Success Response: 200 OK

The following example is illustrative.

```json
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
```

#### Validation

- `id` must be a valid positive integer.
- Invalid ID formats return `400`.
- Inactive products are not publicly accessible.
- IDs must be processed without numeric precision loss.
- The maximum supported ID is `9223372036854775807`.

#### Errors

- `400 INVALID_PRODUCT_ID`: invalid product ID.
- `404 PRODUCT_NOT_FOUND`: missing or inactive product.
- `500 INTERNAL_SERVER_ERROR`: unexpected server error.

## 6. Shopping Cart — Planned

The shopping cart will contain products only.

Planned operations:

- Retrieve cart
- Add product
- Update quantity
- Remove product
- Calculate total

The exact endpoints and schemas will be defined before implementation.

Hotel and experience bookings will not be part of this cart.

## 7. Orders and Checkout — Planned

Customers will be able to:

- Review their shopping cart
- Create an order
- Complete a simulated payment
- View order details and status

Business rules:

- Prices and totals are calculated by the backend.
- Client-provided prices are never trusted.
- Stock availability is checked before confirming purchases.
- Concurrent purchases must not oversell inventory.
- Order and payment status transitions must be defined.

Exact contracts will be designed before implementation.

## 8. Authentication — Planned

Authentication decisions will be made before implementing protected customer
functionality.

Open questions:

- Accounts or guest checkout?
- Authentication provider?
- Token or session management?
- Cart persistence?
- User-specific authorization?
- Administrative permissions?

No authentication endpoints are defined yet.

## 9. Testing Strategy

Every implemented feature must include appropriate tests.

### Unit Tests

- Validation logic
- Pagination calculations
- Business rules

The current isolated API tests exercise these behaviors through Express with a
mocked PostgreSQL pool.

### Integration Tests

- HTTP endpoint behavior
- PostgreSQL queries
- Filtering and sorting
- Error handling

The current integration test suite connects to a separate Neon `testing` branch.

Some tests execute SQL directly. Others use Supertest to send HTTP requests
through Express using real PostgreSQL queries.

Integration tests currently perform read-only operations.

### End-to-End Tests

Complete user workflows once the frontend is implemented.

### Initial Products API Tests

- Returns active products only.
- Retrieves products by ID.
- Returns 404 for missing or inactive products.
- Rejects invalid IDs.
- Rejects invalid pagination values.
- Rejects unknown parameters.
- Rejects repeated parameters.
- Supports category filtering.
- Supports case-insensitive search.
- Supports price filtering.
- Supports every allowed sorting method.
- Uses deterministic ordering.
- Returns correct pagination metadata.
- Returns empty results correctly.

The isolated tests use a mocked database. The real-database integration suite
covers a representative subset of these behaviors.

### Running Tests

From the `backend` directory:

Build TypeScript:

```powershell
npm run build
```

Run ordinary tests with coverage:

```powershell
npx vitest run --coverage
```

Run PostgreSQL integration tests:

```powershell
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
```

Integration tests require `TEST_DATABASE_URL` to point to the Neon testing
branch, not production.

The normal CI workflow runs the build and isolated tests without needing Neon
testing credentials.

### Future Tests

- Cart operations
- Stock conflicts
- Concurrent purchases
- Order transitions
- Simulated payments
- Authorization

## 10. Build Order

Each feature will be developed through the relevant database, backend, testing
and frontend layers.

1. [x] Product catalog API
2. [ ] Product catalog frontend
3. [ ] Product details frontend
4. [ ] Shopping cart
5. [ ] Authentication, if required
6. [ ] Orders and inventory management
7. [ ] Simulated checkout and payments
8. [ ] Complete e-commerce testing
9. [ ] Review future expansion

## 11. Open Decisions

| Decision                              | Decide By                     |
| ------------------------------------- | ----------------------------- |
| Product categories                    | Before catalog implementation |
| Product image storage                 | Before catalog frontend       |
| Show exact stock or availability only | Before catalog frontend       |
| Guest checkout vs accounts            | Before cart and orders        |
| Authentication provider               | Before protected endpoints    |
| Cart persistence                      | Before cart implementation    |
| Stock reservation strategy            | Before checkout               |
| Order cancellation rules              | Before orders                 |
| Payment simulation and statuses       | Before checkout               |
| Administrative operations             | After core e-commerce         |

Product categories have been defined for the initial sample dataset.
The database contains an optional `image_url` field, but image storage is
not yet implemented.

## 12. Future Expansion

### Hotels

- Hotel catalog
- Room types or individual rooms
- Availability by date range
- Reservations
- Separate checkout

### Experiences

- Experience catalog
- Scheduled sessions
- Participant capacity
- Availability management
- Bookings

These modules will be designed separately later.

A unified cart may be evaluated after the independent purchasing and booking
flows exist.

## 13. Decision Log

| Date       | Decision                           | Reason                                       |
| ---------- | ---------------------------------- | -------------------------------------------- |
| 2026-10-12 | Start with product e-commerce      | Focus on API fundamentals                    |
| 2026-10-12 | Defer Hotels and Experiences       | Booking requires additional domain modeling  |
| 2026-10-12 | Separate Express backend           | Practice API contracts                       |
| 2026-10-12 | PostgreSQL without ORM initially   | Learn SQL                                    |
| 2026-10-12 | Pawstars as whole integers         | Fictional currency without fractional units  |
| 2026-10-12 | Server-side pagination             | Efficient retrieval and API practice         |
| 2026-10-12 | Return 200 for valid empty results | No results is not an error                   |
| 2026-10-12 | Reject invalid query parameters    | Predictable API behavior                     |
| 2026-10-12 | Deterministic sorting              | Stable ordering for unchanged datasets       |
| 2026-10-12 | Separate database documentation    | Avoid duplicated database schema definitions |
| 2026-10-12 | Simulated payments only            | No real financial transactions               |
| 2026-10-15 | Product catalog API implemented    | Backend endpoints and database are working   |
| 2026-10-15 | Separate PostgreSQL testing branch | Test real queries without using production   |
| 2026-10-15 | Separate Vitest configurations     | Keep ordinary CI tests independent of Neon   |

---

**Document status:** Product catalog backend implemented and tested.

Other features will be specified incrementally.
