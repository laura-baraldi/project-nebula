# Checkout and Simulated Payment Flow

## 1. Overview

The checkout flow converts a guest shopping cart into a persistent order.

The application records orders in PostgreSQL and attempts to send an order confirmation email. Payment is simulated: no real payment provider is integrated, no card details are collected, and no money is charged.

The backend uses Node.js, Express, TypeScript, PostgreSQL and parameterized SQL without an ORM.

## 2. Scope

### Implemented

- Guest checkout using the existing cart cookie.
- Customer email collection and validation.
- Shipping information collection.
- Server-side product, price, quantity and stock validation.
- Persistent orders and order items.
- Order number generation.
- Transactional order creation and stock updates.
- Simulated payment status.
- Order confirmation email attempt through Resend.
- Checkout frontend and order confirmation screen.

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
- A successful checkout creates a persistent order with item snapshots.
- Stock is decremented only when the order transaction succeeds.
- Cart items are deleted only after successful order creation.
- The cart record and browser cookie are retained.
- The cart expiration is renewed for another seven days.
- Failed transactions must not leave partial orders, incorrect stock or a partially cleared cart.

## 4. Database Design

Migrations `005_create_orders.sql` and `006_add_shipping_details_to_orders.sql` introduce the order tables and shipping information.

### orders

Stores:

- Internal database ID.
- Unique, human-readable order number.
- Customer email address.
- Order status.
- Payment status.
- Total amount in Pawstars.
- Creation timestamp.
- Customer and shipping details.

### order_items

Stores an immutable snapshot of each purchased item:

- Internal database ID.
- Order ID referencing orders.
- Product ID referencing products.
- Product name at the time of checkout.
- Quantity.
- Unit price in Pawstars at the time of checkout.

Order items preserve historical names and prices even if the product catalog changes later.

## 5. Order and Payment Statuses

The initial flow distinguishes an order record from a real payment.

- Order status: `confirmed` after the simulated checkout succeeds.
- Payment status: `simulated`.

These values never imply that an external payment was processed.

## 6. Order Number

Each order receives a unique, human-readable order number.

PostgreSQL generates the number from the internal order ID using the `ORD-` prefix and zero-padding.

Example:

`ORD-00000001`

The internal database ID and public order number are separate concepts.

## 7. Checkout API

Endpoint:

`POST /api/cart/checkout`

The request must use JSON and include customer contact and shipping information.

Required fields:

- `customer_email`
- `first_name`
- `last_name`
- `address_line1`
- `city`
- `postal_code`
- `country`

Optional fields:

- `address_line2`
- `phone`

Unsupported fields are rejected. The request does not contain authoritative product prices or a client-calculated total.

The backend:

1. Validates the request and email.
2. Resolves the guest cart using the existing cookie.
3. Locks the cart and validates its expiration.
4. Loads cart items and locks the relevant product rows.
5. Rejects an empty cart.
6. Checks product activity and stock.
7. Reads current prices from PostgreSQL and calculates the total.
8. Creates the order and item snapshots in a database transaction.
9. Decrements stock.
10. Deletes the cart items and renews the cart expiration.
11. Commits the transaction.
12. Attempts to send the confirmation email after commit.

### Successful response

The endpoint returns `201 Created` with an `order` object containing:

- `order_number`
- `customer_email`
- `total_pawstars`
- `payment_status`
- `created_at`
- `items`

Each returned item includes its product name, quantity, unit price and line total.

The payment status is `simulated`.

## 8. Email Confirmation

The backend uses Resend to attempt delivery of an order confirmation email.

The email includes the order number and confirmation message.

Backend environment variables:

- `RESEND_API_KEY`
- `EMAIL_FROM`

Email delivery is attempted after the database transaction commits.

Email delivery failure does not roll back a successfully committed order. The failure is logged separately.

## 9. Error Handling

Expected cases include:

- Invalid email or request: `400`.
- Missing, expired or invalid cart: `404`.
- Empty cart: `409`.
- Product unavailable or insufficient stock: `409`.
- Unsupported content type: `415`.
- Unexpected database or server failure: `500`.

Errors use the existing structured JSON error format and must not expose internal details.

## 10. Frontend

The checkout page is available at `/checkout`.

The flow has two steps:

1. Contact and shipping information.
2. Simulated payment confirmation.

The checkout page explicitly warns users that no real payment is processed and asks them not to enter real personal information. Submitted demo details are stored in the database.

The payment step displays a fictional demo card. No card information is entered or collected.

After successful checkout, the order confirmation screen displays:

- Order number.
- Confirmation email address.
- Purchased items and quantities.
- Total in Pawstars.
- A notice that payment was simulated.

## 11. Testing

Tests should cover:

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
- Cart item deletion after successful checkout.
- Cart and cookie preservation.
- Transaction rollback when a database operation fails.
- Concurrent attempts to purchase limited stock.
- Email success and failure after order creation.
- Confirmation that no real payment is attempted.

Database integration tests must use the existing isolated testing database setup.

## 12. Implementation Status

- [x] Simulated payment only
- [x] PostgreSQL persistence for orders
- [x] Order item snapshots
- [x] Shipping details
- [x] Order number generation
- [x] Transactional checkout
- [x] Stock validation and decrement
- [x] Cart item deletion after successful checkout
- [x] Cart and cookie preservation
- [x] Checkout API
- [x] Resend email integration attempt
- [x] Checkout frontend
- [x] Order confirmation screen

---
