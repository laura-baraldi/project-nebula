# Shopping Cart API — Design

## 1. Overview

The Shopping Cart API allows visitors to manage a persistent shopping cart without creating an account.

Technology stack:

- Node.js, Express and TypeScript
- PostgreSQL
- Parameterized SQL without an ORM

This branch covers the backend API only. The frontend will be developed separately.

## 2. Scope

### Included

- Guest shopping carts
- Cart persistence
- Adding products
- Updating quantities
- Removing products
- Stock validation
- Price and total calculations
- Cart expiration
- Cookie and CSRF security
- Automated tests

### Out of Scope

- User authentication
- Checkout and payments
- Orders
- Shipping
- Inventory reservations
- Frontend cart interface

## 3. Cart Ownership and Identification

- Guest users do not need to register or log in.
- Each cart is identified through a secure, randomly generated token.
- The token is stored in an HttpOnly cookie.
- PostgreSQL stores a hash of the token, not the original token.
- Internal cart IDs are not used as access credentials.
- Cart access tokens must never appear in URLs or logs.

### Cart Creation

- GET /api/cart returns an empty cart when no cart exists.
- Opening an empty cart does not create a database record.
- A cart is created when the first valid product is added.
- Invalid additions must not create a cart.

## 4. Cart Lifecycle

- Carts expire after 7 days without a successful modification.
- Adding, updating or removing an item renews the expiration.
- GET requests do not renew expiration.
- The cookie lifetime follows the cart expiration.
- Expired carts cannot be accessed.
- A new successful addition after expiration creates a new cart.
- Expired database records may be deleted through a separate cleanup process.
- Removing the last item leaves an empty but valid cart.

## 5. Business Rules

### Quantities

- Quantities must be positive integers.
- Maximum quantity: 20 units per product.
- Adding an existing product increases its quantity.
- Updating an item replaces its quantity.
- Removing an item uses a separate DELETE operation.
- The same product cannot appear twice in the same cart.

### Stock

- Products must exist and be active when added.
- Adding or increasing quantities cannot exceed available stock.
- Insufficient stock returns HTTP 409 Conflict.
- Failed operations leave the cart unchanged.
- Adding products does not reserve or decrease inventory.
- Stock is checked again during checkout in a future feature.

### Stock Changes and Inactive Products

- Existing items remain in the cart if stock decreases.
- Existing items remain visible if a product becomes inactive.
- Unavailable items must be identified in the API response.
- Unavailable products cannot have their quantities increased.
- Visitors can reduce quantities or remove unavailable items.
- The frontend will display availability warnings.

### Prices and Totals

- The backend retrieves current product prices from PostgreSQL.
- Price changes are reflected in the cart.
- Prices are not locked when products are added.
- All amounts are whole Pawstars (PWS).
- Item subtotal = unit price × quantity.
- Cart total = sum of item subtotals.
- The frontend cannot provide or override prices or totals.

## 6. Database Design

Two cart tables have been implemented in PostgreSQL:
`carts` and `cart_items`.

### carts

Stores:

- Internal cart ID
- Hashed access token
- Creation timestamp
- Last modification timestamp
- Expiration timestamp

### cart_items

Stores:

- Internal item ID
- Cart ID (foreign key)
- Product ID (foreign key)
- Quantity
- Creation and update timestamps

Database constraints:

- Prevent duplicate products in the same cart.
- Enforce valid quantities.
- Maintain relationships between carts, items and products.

The schema was created using SQL migration
`004_create_carts.sql`.

## 7. REST API

All four shopping cart endpoints are implemented.

| Method | Endpoint                     | Purpose                                |
| ------ | ---------------------------- | -------------------------------------- |
| GET    | `/api/cart`                  | Retrieve the current cart              |
| POST   | `/api/cart/items`            | Add a product or increase its quantity |
| PATCH  | `/api/cart/items/:productId` | Replace an item's quantity             |
| DELETE | `/api/cart/items/:productId` | Remove a product                       |

### API Rules

- The cart is identified through the guest cookie, not a cart ID.
- GET returns an empty cart when no valid cart exists.
- POST creates a cart if necessary and adds to existing quantities.
- PATCH updates an existing item's quantity without adding to it.
- DELETE removes one item, even if the product is unavailable.
- Removing the last item leaves an empty, valid cart.
- POST and PATCH enforce the maximum quantity of 20.
- The backend calculates prices, subtotals and totals.
- Responses include product availability information.
- Successful modifications renew the seven-day expiration.
- Errors use the project's standard JSON error format.

For request bodies, response examples and HTTP error codes,
see [API Design](./api-design.md).

## 8. Security

- Use cryptographically secure random cart tokens.
- Store only token hashes in PostgreSQL.
- Use HttpOnly cookies.
- Use Secure cookies in production.
- Use SameSite=Lax cookies.
- Validate trusted request origins for state-changing operations.
- Require JSON request bodies for POST and PATCH.
- Configure CORS with explicit trusted origins.
- Protect state-changing endpoints against CSRF.
- Use parameterized SQL queries.
- Validate product IDs and quantities.
- Do not expose internal errors or sensitive tokens.

Security measures must be tested before the API is considered complete.

## 9. Concurrency and Data Integrity

- Database writes must be atomic.
- Use transactions where multiple operations must succeed together.
- Prevent concurrent requests from corrupting cart quantities.
- Preserve existing cart data when an operation fails.
- Enforce important constraints in PostgreSQL, not only in TypeScript.

## 10. Testing Strategy

Automated tests cover the following behaviors, with some
additional PATCH edge cases still pending:

- Empty and existing carts
- Cart creation and persistence
- Adding and removing products
- Updating quantities
- Maximum quantity validation
- Stock availability
- Inactive products
- Price changes and totals
- Missing and expired cookies
- CSRF and cookie security
- Error responses
- Failed operations
- Database constraints
- Transactions and concurrent updates

PostgreSQL integration tests will use the separate testing database.

## 11. Design Status

- [x] Choose guest-only cart ownership.
- [x] Choose cookie-based cart identification.
- [x] Define seven-day cart expiration.
- [x] Define maximum product quantity.
- [x] Define stock availability rules.
- [x] Define cart preservation rules.
- [x] Define inactive product behavior.
- [x] Define price change behavior.
- [x] Choose database tables.
- [x] Choose REST operations.
- [x] Define security requirements.
- [x] Define transaction and testing requirements.

## 12. Implementation Status

- [x] Create PostgreSQL migrations.
- [x] Implement cart token generation and hashing.
- [x] Implement cookie handling helpers.
- [x] Add database constraint integration tests.
- [x] Add token and cookie unit tests.
- [x] Configure GitHub Actions integration tests.
- [x] Implement CSRF origin protection and CORS.
- [x] Implement GET /api/cart.
- [x] Implement POST /api/cart/items.
- [x] Implement POST quantity and stock validation.
- [x] Implement cart price and total calculations.
- [x] Implement seven-day cart expiration checks and POST renewal.
- [x] Implement POST database transactions.
- [x] Add GET and POST API unit and integration tests.
- [x] Document GET and POST API contracts.
- [ ] Implement PATCH /api/cart/items/:productId.
- [ ] Implement DELETE /api/cart/items/:productId.
- [ ] Complete remaining cart API tests and documentation.
- [ ] Open and merge the pull request.
