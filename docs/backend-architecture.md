
# Backend Architecture — Project Nebula

## Overview

The backend is built with Node.js, Express and TypeScript.

The application is organized into separate modules to keep
responsibilities clear and make future development easier.

## Project Structure

### `src/app.ts`

Creates and configures the Express application.

Responsibilities:
- Initialize Express
- Configure middleware, such as `express.json()`
- Register routers under their API paths
- Export the application for use by the server and tests

### `src/server.ts`

Starts the HTTP server.

Responsibilities:
- Import the Express application
- Define the listening port
- Start listening for incoming HTTP requests

### `src/routes/products.routes.ts`

Defines HTTP endpoints related to products.

Responsibilities:
- Register product routes, such as `GET /api/products`
- Handle incoming product-related HTTP requests
- Send HTTP responses

## Request Flow

1. The client sends an HTTP request.
2. The Express server receives the request.
3. The application forwards the request to the appropriate router.
4. The matching route handles the request.
5. Express sends an HTTP response to the client.

## Why Separate app.ts and server.ts?

Keeping the application configuration separate from server
startup makes the backend easier to maintain and test.

Automated tests can import the Express application without
automatically starting a listening HTTP server.

## Future Structure

As the project grows, we may introduce additional modules:

- `routes/` — HTTP endpoint definitions
- `controllers/` — HTTP request and response handling
- `services/` — Business logic
- `repositories/` — Database queries and persistence
- `db/` — Database connection and migrations

These modules will be introduced when they are needed,
rather than adding unnecessary complexity from the start.
