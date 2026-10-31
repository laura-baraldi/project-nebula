# Backend Architecture — Project Nebula

## Overview

The backend is built with Node.js, Express and TypeScript.

The application is organized into separate modules to keep responsibilities clear and make future development easier.

## Project Structure

### `src/app.ts`

Creates and configures the Express application.

Responsibilities:

- Initialize Express.
- Configure middleware, such as `express.json()`.
- Register routers under their API paths.
- Configure CORS for the frontend.
- Export the application for use by the server and tests.

### `src/server.ts`

Starts the HTTP server.

Responsibilities:

- Import the Express application.
- Define the listening port.
- Start listening for incoming HTTP requests.

### `src/routes/products.routes.ts`

Defines HTTP endpoints related to products.

Responsibilities:

- Register product routes, such as `GET /api/products`.
- Handle incoming product-related HTTP requests.
- Send HTTP responses.

### `src/routes/cart.routes.ts`

Defines the guest shopping cart endpoints.

Responsibilities:

- Read the guest cart.
- Add products and update quantities.
- Remove cart items.
- Validate cart requests.
- Use the cart cookie and cart security middleware.
- Delegate database operations to the cart repository.

### `src/routes/checkout.routes.ts`

Defines the checkout endpoint.

Responsibilities:

- Validate customer and shipping information.
- Read the existing guest cart cookie.
- Call the checkout repository.
- Attempt to send the order confirmation email after successful checkout.
- Return the created order.

### `src/db/pool.ts`

Creates and exports the PostgreSQL connection pool using the `pg` library.

Responsibilities:

- Read the database connection string from `DATABASE_URL`.
- Initialize the PostgreSQL connection pool.
- Provide a shared pool for database queries.
- Keep database connection configuration separate from HTTP routes.

### `src/db/checkout/checkout.repository.ts`

Contains the PostgreSQL checkout operation.

Responsibilities:

- Lock and validate the guest cart.
- Lock the relevant product rows.
- Validate product availability and stock.
- Calculate the order total using database prices.
- Create the order and item snapshots.
- Decrement stock.
- Delete cart items and renew cart expiration.
- Commit or roll back the transaction.

### `src/email/email.service.ts`

Contains the order confirmation email integration using Resend.

Responsibilities:

- Send the order confirmation email.
- Read credentials from backend environment variables.
- Report email delivery errors to the calling route.

## Request Flow

1. The client sends an HTTP request.
2. The Express server receives the request.
3. The application forwards the request to the appropriate router.
4. The matching route validates the request.
5. The route calls the relevant repository or service when database or external integration access is required.
6. PostgreSQL returns the query results.
7. The route processes the results and sends an HTTP response to the client.

For checkout, the order transaction commits before the route attempts to send the confirmation email.

## Why Separate app.ts and server.ts?

Keeping the application configuration separate from server startup makes the backend easier to maintain and test.

Automated tests can import the Express application without automatically starting a listening HTTP server.

## Future Structure

As the project grows, we may introduce additional modules:

- `routes/` — HTTP endpoint definitions
- `controllers/` — HTTP request and response handling
- `services/` — Business logic and external integrations
- `repositories/` — Database queries and persistence
- `db/` — Database connection and migrations

These modules will be introduced when they are needed, rather than adding unnecessary complexity from the start.
