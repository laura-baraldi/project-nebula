# Project Nebula

Project Nebula is a fictional full-stack e-commerce platform set on a planet inhabited by hairless cats.

The project is built to practice REST API design, TypeScript, React, PostgreSQL, security, automated testing and frontend-backend communication.

All purchases and payments are simulated. The fictional currency is the Pawstar (PWS).

## Project Purpose

Project Nebula is a hands-on learning project built to explore how a full-stack e-commerce platform works, from product catalogues and shopping carts to checkout, order management and database operations.

The project combines practical software engineering challenges with a playful concept: a fictional world inhabited by hairless cats. The implementation takes the technical side seriously, while leaving room to experiment, learn and have fun along the way.

## Screenshots

### Product Catalog

![Product Catalog](docs/screenshots/catalog.png)

### Product Details

![Product Details](docs/screenshots/product-details.png)

### Shopping Cart

![Shopping Cart](docs/screenshots/shopping-cart.png)

### Checkout

![Checkout](docs/screenshots/checkout.png)

### Simulated Payment

![Simulated Payment](docs/screenshots/payment.png)

## Tech Stack

| Layer    | Technologies                             |
| -------- | ---------------------------------------- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend  | Node.js, Express, TypeScript             |
| Database | PostgreSQL (Neon), plain SQL             |
| Testing  | Vitest, Supertest, React Testing Library |
| CI       | GitHub Actions                           |

The frontend communicates with the Express API through HTTP. Database access and business logic remain in the backend.

## Features

### Implemented

**Product Catalog and Product Details**

- Product listing and individual product pages.
- Category and price filtering.
- Case-insensitive product search.
- Sorting and server-side pagination.
- Responsive product cards and product images.
- URL-based filters and pagination.
- Loading states, empty states and error handling.
- Product details, prices and stock availability.

**Shopping Cart Backend**

- Guest shopping carts without user accounts.
- Persistent cart data stored in PostgreSQL.
- Secure cart identification using HttpOnly cookies and hashed tokens.
- GET, POST, PATCH and DELETE cart endpoints.
- Quantity limits and stock availability validation.
- Current prices, subtotals and cart totals calculated by the backend.
- Support for removing or reducing unavailable items.
- Seven-day cart expiration, renewed after successful modifications.
- Origin validation, CORS protection and database transactions.
- Automated unit, HTTP and PostgreSQL integration tests.

**Shopping Cart Frontend**

- Add to Cart controls on product interfaces.
- A dedicated `/cart` page.
- Quantity controls and item removal.
- Cart navigation and cart update notifications.
- Loading, empty and error states.
- Frontend API calls through a dedicated cart API module.
- Browser-managed cookies for guest cart identification.

**Checkout and Orders**

- Checkout page at `/checkout`.
- Customer email and shipping information form.
- Server-side validation of customer details, product availability and stock.
- PostgreSQL order and order item persistence.
- Generated order numbers.
- Transactional stock updates.
- Cart items cleared after successful checkout while retaining the cart cookie.
- Simulated payment status; no real payment provider or card collection.
- Order confirmation screen.
- Order confirmation email attempt through Resend.

**Testing and CI**

- Automated frontend and backend tests.
- PostgreSQL integration tests using a separate Neon testing branch.
- GitHub Actions checks for build, tests and coverage.

Real browser-to-backend integration and complete end-to-end shopping workflows must be verified separately before the complete shopping flow is considered tested.

### Planned

- Complete browser-to-backend integration verification.
- End-to-end tests for complete shopping workflows.
- Authentication, if required for future features.

### Future Expansion

Hotel reservations and experience booking are outside the current scope and may be implemented as separate modules later.

Real payment processing is not implemented.

## Project Structure

```text
project-nebula/
├── frontend/       Next.js frontend and tests
├── backend/        Express API, SQL migrations and tests
├── docs/           API, database and architecture documentation
└── .github/        GitHub Actions workflows
```

The shopping cart and checkout backend separate HTTP routes from database operations. Repository modules handle database queries and transactions.

## Configuration

### Backend

Create `backend/.env` and configure the PostgreSQL connection:

```dotenv
DATABASE_URL=your_postgresql_connection_string
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=your_verified_sender
```

The Resend variables are used for the order confirmation email attempt.

The API runs at `http://localhost:4000` by default.

### Frontend

The frontend uses `NEXT_PUBLIC_API_URL` to determine the base URL of the backend API.

If the variable is not set, the frontend defaults to:

```dotenv
http://localhost:4000
```

For local development, this fallback can be used without additional configuration. To configure a different backend URL, create `frontend/.env.local` and add:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Replace the URL with the address of the backend environment you want to use. Restart the Next.js development server after changing environment variables.

`NEXT_PUBLIC_API_URL` is exposed to the browser and must contain only a public API base URL, never secrets or credentials.

## Running the Backend

From the `backend` directory, install dependencies:

```powershell
npm.cmd install
```

Create `backend/.env` with the required `DATABASE_URL`, then start the backend:

```powershell
npm.cmd run dev
```

### Available API Endpoints

| Method | Endpoint                     | Purpose                                  |
| ------ | ---------------------------- | ---------------------------------------- |
| GET    | `/api/health`                | Health check                             |
| GET    | `/api/products`              | List, filter, sort and paginate products |
| GET    | `/api/products/:id`          | Retrieve product details                 |
| GET    | `/api/cart`                  | Retrieve the guest cart                  |
| POST   | `/api/cart/items`            | Add a product to the cart                |
| PATCH  | `/api/cart/items/:productId` | Replace an item's quantity               |
| DELETE | `/api/cart/items/:productId` | Remove an item                           |
| POST   | `/api/cart/checkout`         | Create an order from the guest cart      |

Example product request:

```text
GET /api/products?category=clothing&sort=price_asc&page=1&limit=20
```

Example cart addition:

```http
POST /api/cart/items
Content-Type: application/json
Origin: http://localhost:3000
```

```json
{
  "product_id": "1",
  "quantity": 2
}
```

The cart uses a browser cookie to identify the guest. POST, PATCH, DELETE and checkout require requests from the trusted frontend origin.

## Running the Frontend

From the `frontend` directory, install dependencies:

```powershell
npm.cmd install
```

Start the Next.js development server:

```powershell
npm.cmd run dev
```

The frontend runs at `http://localhost:3000`.

Useful routes:

- `/products` — product catalog.
- `/products/:id` — product details.
- `/cart` — shopping cart.
- `/checkout` — checkout and simulated payment.

The Express backend must be running for the frontend to retrieve product data and use the shopping cart and checkout APIs.

## Testing

### Frontend

From the `frontend` directory:

```powershell
npx.cmd vitest run
```

Run the tests with coverage:

```powershell
npx.cmd vitest run --coverage
```

### Backend

Run the backend test scripts from the `backend` directory using the scripts defined in its `package.json`. PostgreSQL integration tests require the configured test database.

GitHub Actions runs automated frontend and backend checks.

## Documentation

- [API Design](docs/api-design.md) — API endpoints, request and response behavior.
- [Database Design](docs/database-design.md) — PostgreSQL tables, constraints and migrations.
- [Backend Architecture](docs/backend-architecture.md) — backend modules and request flow.
- [Shopping Cart Design](docs/shopping-cart-design.md) — guest cart API and business rules.
- [Shopping Cart Frontend Design](docs/shopping-cart-frontend-design.md) — cart and checkout interfaces.
- [Payment Flow](docs/payment-flow.md) — checkout, order creation and simulated payment.
- [Frontend Catalog Design](docs/frontend-catalog-design.md) — catalog UI and filtering.
- [Product Detail Design](docs/product-detail-design.md) — product detail pages.

## Project Status

The product catalog, product detail pages, guest shopping cart and checkout flow are implemented.

The checkout creates persistent orders and order item snapshots, validates and decrements stock within a database transaction, and records a simulated payment status. The cart cookie is retained after checkout while its items are cleared.

No real payment provider is connected and no card details are collected. Browser-to-backend integration and complete end-to-end shopping workflow verification remain to be completed.
