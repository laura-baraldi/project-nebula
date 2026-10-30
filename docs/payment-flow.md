# Checkout and Simulated Payment Flow

## 1. Overview

The checkout flow converts a guest shopping cart into a persistent order.

The application records orders in PostgreSQL and sends an order confirmation email. Payment is simulated: no real payment provider is integrated, no card details are collected, and no money is charged.

The backend uses Node.js, Express, TypeScript, PostgreSQL and parameterized SQL without an ORM.

## 2. Scope

### Included

- Guest checkout using the existing cart cookie.
- Customer email collection and validation.
- Server-side product, price, quantity and stock validation.
- Persistent orders and order items.
- Order number generation.
- Transactional order creation and stock updates.
- Simulated payment status.
- Order confirmation emails.
- Automated unit, HTTP and database integration tests.

### Out of Scope

- Real payment processing.
- Credit or debit card collection.
- Customer accounts and order history.
- Shipping integrations.
- Hotels and Experiences.

## 3. Checkout Rules

- The backend identifies the cart through the existing HttpOnly cookie.
- The client cannot submit authoritative prices or totals.
- Product prices and availability are retrieved from PostgreSQL.
- All amounts are integer Pawstars (PWS).
- Inactive products and insufficient stock prevent checkout.
- Invalid or expired carts cannot be checked out.
- Empty carts cannot create orders.
- The backend recalculates the order total.
- A successful checkout creates a persistent order with its item snapshots.
- Stock is decremented only when the order transaction succeeds.
- The cart is cleared only after successful order creation.
- Failed transactions must not leave partial orders, incorrect stock or a partially cleared cart.

## 4. Database Design

The implementation will introduce two tables through a new SQL migration.

### orders

Stores the order-level information:

- Internal database ID.
- Unique, human-readable order number.
- Customer email address.
- Order status.
- Payment status.
- Total amount in Pawstars.
- Creation timestamp.

### order_items

Stores an immutable snapshot of each purchased item:

- Internal database ID.
- Order ID referencing orders.
- Product ID referencing products.
- Product name at the time of checkout.
- Quantity.
- Unit price in Pawstars at the time of checkout.

Use foreign keys, CHECK constraints, appropriate indexes and NOT NULL constraints where applicable.

Order items must preserve historical names and prices even if the product catalog changes later.

The exact column definitions and deletion rules must be finalized against the existing schema before writing the migration.

## 5. Order and Payment Statuses

The initial flow must distinguish an order record from a real payment.

- Order status: `confirmed` after the simulated checkout succeeds.
- Payment status: `simulated`.

These values must never imply that an external payment was processed.

A future payment provider may introduce additional payment states without requiring the existing order model to be discarded.

## 6. Order Number

Each order receives a unique, human-readable order number.

The number must be generated or allocated safely under concurrent requests. Database uniqueness must be enforced.

The internal database ID and the public order number are separate concepts.

## 7. Checkout API

Proposed endpoint:

`POST /api/cart/checkout`

The request contains the customer email address. It does not contain authoritative product prices or a client-calculated total.

The backend:

1. Validates the request and email.
2. Resolves the guest cart using the existing cookie.
3. Validates cart contents, product activity and stock.
4. Reads current prices from PostgreSQL.
5. Creates the order and item snapshots in a database transaction.
6. Decrements stock and clears the cart within the same transaction.
7. Returns the created order number, status and total.
8. Attempts to send the confirmation email after the database transaction commits.

The exact request and response schemas will be documented before implementation.

### Successful response

The endpoint returns `201 Created` with an `order` object containing:

- `order_number`
- `customer_email`
- `total_pawstars`
- `payment_status` (`simulated`)

## 8. Email Confirmation

The confirmation email includes:

- Order number.
- Order date.
- Purchased products, quantities and unit prices.
- Total in Pawstars.
- A clear statement that payment was simulated and no money was charged.

Use an email delivery provider through a backend-only integration. Credentials must be stored in environment variables and must never be exposed to the frontend.

Email delivery failure must not roll back a successfully committed order. The failure must be logged safely and the design should allow email delivery to be retried.

## 9. Error Handling

Expected cases include:

- Invalid email or request: `400`.
- Missing, expired or invalid cart: handled according to existing cart API conventions.
- Product unavailable or insufficient stock: `409`.
- Unexpected database or server failure: `500`.

Errors must use the existing structured JSON error format and must not expose internal details.

## 10. Testing

Tests must cover:

- Invalid email and request bodies.
- Missing and expired cart cookies.
- Empty carts.
- Inactive products.
- Insufficient stock.
- Server-authoritative prices and totals.
- Successful order creation.
- Correct order item snapshots.
- Unique order numbers.
- Stock updates.
- Cart clearing after successful checkout.
- Rollback when a database operation fails.
- Concurrent attempts to purchase limited stock.
- Email success and email failure after order creation.
- Confirmation that no real payment is attempted.

Database integration tests must use the existing isolated testing database setup.

## 11. Implementation Order

1. Finalize this design against the existing backend and migrations.
2. Create the order tables and constraints in a new SQL migration.
3. Implement and test the transactional checkout service.
4. Implement the checkout endpoint and validation.
5. Implement the email delivery integration.
6. Build the checkout and order confirmation frontend.
7. Run the full relevant test suites and coverage checks.
8. Update the database and API documentation.

## 12. Design Status

- [x] Simulated payment only
- [x] PostgreSQL persistence for orders
- [x] Order item snapshots
- [x] Finalize schema and transaction details
- [x] Implement migration
- [x] Implement backend checkout
- [ ] Implement email delivery
- [ ] Implement frontend checkout
- [ ] Complete tests and documentation
