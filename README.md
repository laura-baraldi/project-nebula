# Project Nebula

Project Nebula is a fictional full-stack e-commerce platform set on a planet inhabited by hairless cats.

The project is built to practice REST API design, TypeScript, React, PostgreSQL, security, automated testing and frontend-backend communication.

All purchases and payments are simulated. The fictional currency is the Pawstar (PWS).

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

**Product Catalog**

- Product listing and individual product pages.
- Category and price filtering.
- Case-insensitive product search.
- Sorting and server-side pagination.
- Responsive product cards and product images.
- URL-based filters and pagination.
- Loading states, empty states and error handling.

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

**Testing and CI**

- Automated frontend and backend tests.
- PostgreSQL integration tests using a separate Neon testing branch.
- GitHub Actions checks for build, tests and coverage.

### Planned

- Shopping cart frontend interface.
- Orders and inventory management during checkout.
- Simulated checkout and payments.
- Authentication, if required for future features.
- Complete end-to-end shopping workflows.

### Future Expansion

Hotel reservations and experience booking are outside the current scope and may be implemented as separate modules later.

## Project Structure

```text
project-nebula/
├── frontend/       Next.js frontend and tests
├── backend/        Express API, SQL migrations and tests
├── docs/           API, database and architecture documentation
└── .github/        GitHub Actions workflows
```

The shopping cart backend separates HTTP routes from database operations. Repository modules handle reading cart data and modifying it through PostgreSQL transactions.

## Running the Backend

From the `backend` directory, install dependencies:

```powershell
npm.cmd install
```

Create `backend/.env` and provide your PostgreSQL connection string:

```dotenv
DATABASE_URL=your_postgresql_connection_string
```

Start the backend:

```powershell
npm.cmd run dev
```

The API runs at `http://localhost:4000` by default.

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

The cart uses a browser cookie to identify the guest. POST, PATCH and DELETE require requests from the trusted frontend origin.

For complete request formats, responses, validation rules and errors, see [API Design](docs/api-design.md).

## Running the Frontend

From the `frontend` directory:

```powershell
npm.cmd install
npm.cmd run dev
```

The frontend runs at `http://localhost:3000`.

The product catalog is available at:

```text
http://localhost:3000/products
```

The Express backend must be running for the frontend to retrieve product data.

The frontend currently includes the product catalog and product details. The shopping cart interface will be developed separately.

## Testing

### Backend Unit and HTTP Tests

From the `backend` directory:

```powershell
npm.cmd run build
npx.cmd vitest run --coverage
```

These tests use mocked database operations to verify repository logic, HTTP responses, validation, cookies and error handling.

### PostgreSQL Integration Tests

Integration tests use a dedicated Neon testing database.

Add its connection string to `backend/.env`:

```dotenv
TEST_DATABASE_URL=your_neon_testing_connection_string
```

Run:

```powershell
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
```

These tests exercise real PostgreSQL queries and API behavior, including cart creation, quantity updates, deletion, expiration and selected concurrent operations.

`TEST_DATABASE_URL` must point to the separate testing database, never the main application database.

### Frontend Tests

From the `frontend` directory:

```powershell
npm.cmd run test
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

GitHub Actions runs automated frontend and backend checks.

Never commit `.env` files, database passwords or other credentials.

## Documentation

- [API Design](docs/api-design.md) — Endpoints, validation and responses.
- [Shopping Cart Design](docs/shopping-cart-design.md) — Cart rules, security and lifecycle.
- [Database Design](docs/database-design.md) — Tables, constraints and SQL design.
- [Backend Architecture](docs/backend-architecture.md) — Backend structure and responsibilities.
- [Frontend Catalog Design](docs/frontend-catalog-design.md) — Catalog UI and filtering.
- [Product Detail Design](docs/product-detail-design.md) — Individual product pages.

## Project Status

The product catalog frontend and backend are implemented and tested.

The guest shopping cart backend is also implemented, including all four REST operations: GET, POST, PATCH and DELETE.

The next development phase will focus on the shopping cart frontend, followed by orders and simulated checkout.
