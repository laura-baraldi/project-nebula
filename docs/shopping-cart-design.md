# Shopping Cart API — Design

## 1. Overview

The Shopping Cart API allows visitors to manage a persistent shopping cart without creating an account.

Technology stack:

- Node.js, Express and TypeScript
- PostgreSQL
- Parameterized SQL without an ORM

The backend API is implemented. The frontend interface is documented separately in [Shopping Cart Frontend Design](./shopping-cart-frontend-design.md).

Checkout is implemented separately and uses the existing guest cart.

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
- Checkout and order creation

### Separate or Out of Scope

- User authentication
- Real payment processing
- Shipping integrations
- Inventory reservations
- Complete end-to-end browser-to-backend verification

The shopping cart frontend interface is implemented separately from this backend design.

## 3. Cart Ownership and Identification

- Guest users do not need to register or log in.
- Each cart is identified through a secure, randomly generated token.
- The token is stored in an HttpOnly cookie.
- PostgreSQL stores a hash of the token, not the original token.
- Internal cart IDs are not used as access credentials.
- Cart access tokens must never appear in URLs or logs.

### Cart Creation

- GET `/api/cart` returns an empty cart when no cart exists.
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
- Successful checkout deletes the cart items but retains the cart and its cookie.
- Checkout renews the retained cart expiration for another seven days.

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
- Stock is checked again during checkout.
- Checkout locks the relevant product rows and decrements stock within the order transaction.

### Stock Changes and Inactive Products

- Existing items remain in the cart if stock decreases.
- Existing items remain visible if a product becomes inactive.
- Unavailable items must be identified in the API response.
- Unavailable products cannot have their quantities increased.
- Visitors can reduce quantities or remove unavailable items.
- The frontend displays availability warnings.

### Prices and Totals

- The backend retrieves current product prices from PostgreSQL.
- Price changes are reflected in the cart.
- Prices are not locked when products are added.
- All amounts are whole Pawstars (PWS).
- Item subtotal = unit price × quantity.
- Cart total = sum of item subtotals.
- The frontend cannot provide or override prices or totals.
- Checkout recalculates the total using current database prices.

## 6. Database Design

The cart uses two PostgreSQL tables: `carts` and `cart_items`.

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

The schema was created using SQL migration `004_create_carts.sql`.

Orders are stored separately in `orders` and `order_items`. See [Database Design](./database-design.md).

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

For request bodies, response examples and HTTP error codes, see [API Design](./api-design.md).

### Checkout

Checkout is implemented through:

`POST /api/cart/checkout`

It uses the existing guest cart cookie, validates customer and shipping details, rechecks stock and creates an order.

The checkout transaction creates the order and item snapshots, updates stock and deletes the cart items. The cart itself is retained.

See [Payment Flow](./payment-flow.md) for the checkout process.

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

Security measures must continue to be verified through automated tests and deployment checks.

## 9. Concurrency and Data Integrity

- Database writes must be atomic.
- Use transactions where multiple operations must succeed together.
- Prevent concurrent requests from corrupting cart quantities.
- Preserve existing cart data when an operation fails.
- Enforce important constraints in PostgreSQL, not only in TypeScript.
- Checkout locks the cart and product rows to coordinate concurrent modifications and prevent stock overselling.

## 10. Testing Strategy

Automated unit, HTTP and PostgreSQL integration tests cover the main cart operations, validation rules and error scenarios.

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
- Checkout stock validation and order creation

PostgreSQL integration tests use a separate testing database.

Frontend component tests are documented in [Shopping Cart Frontend Design](./shopping-cart-frontend-design.md). Real browser-to-backend verification remains a separate step.

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
- [x] Define checkout behavior.

## 12. Implementation Status

### Database and Security

- [x] Create PostgreSQL cart tables, constraints and migrations.
- [x] Implement secure cart tokens and SHA-256 hashing.
- [x] Implement HttpOnly cookie handling.
- [x] Configure CORS and trusted-Origin protection.
- [x] Implement seven-day cart expiration and renewal.
- [x] Use parameterized SQL and PostgreSQL transactions.
- [x] Protect concurrent cart modifications using row locks.

### API Endpoints

- [x] Implement GET `/api/cart`.
- [x] Implement POST `/api/cart/items`.
- [x] Implement PATCH `/api/cart/items/:productId`.
- [x] Implement DELETE `/api/cart/items/:productId`.
- [x] Implement quantity and stock validation.
- [x] Calculate prices, subtotals and totals.
- [x] Preserve unavailable items in existing carts.
- [x] Implement POST `/api/cart/checkout`.
- [x] Create orders and order item snapshots.
- [x] Validate and decrement stock during checkout.
- [x] Retain the cart and cookie after checkout.

### Testing

- [x] Add token and cookie unit tests.
- [x] Add repository unit tests for cart operations.
- [x] Add HTTP tests for all four cart endpoints.
- [x] Add PostgreSQL integration tests for cart operations.
- [x] Test expiration, validation errors and rollback behavior.
- [x] Test stock conflicts and inactive products.
- [x] Test selected concurrent cart operations.

### Documentation and Completion

- [x] Document API contracts and business rules.
- [x] Update the project README.
- [ ] Complete final test and CI verification.
- [ ] Verify the complete browser-to-backend shopping flow.
- [ ] Open and review the pull request.
- [ ] Merge the completed branch into main.
