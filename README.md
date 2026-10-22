# Project Nebula

A fictional full-stack booking and e-commerce platform set on a planet inhabited by hairless cats.

The project is being developed to practice full-stack software development, API design, SQL, testing and frontend-backend communication.

All purchases and payments are simulated.

## Features

### Implemented

**Backend**

- Product catalog REST API
- Product details API
- Category and price filtering
- Case-insensitive product search
- Sorting and server-side pagination
- PostgreSQL database with 30 sample products
- Database migrations and product seed

**Frontend**

- Next.js product catalog connected to the Express API
- Responsive product cards with 30 product images
- Category filtering with a desktop sidebar and collapsible mobile menu
- Product search with URL normalization
- Sorting by price, name and creation date
- Pagination with Previous and Next navigation
- Shareable URL-based filter state
- Empty results and out-of-range page handling
- Loading skeleton and error recovery

**Testing and CI**

- Automated frontend and backend tests
- PostgreSQL integration tests
- GitHub Actions for frontend and backend checks

### Planned

- Individual product detail pages
- Shopping cart
- Stock availability and inventory management
- Orders
- Simulated checkout and payments

### Future Expansion

- Hotel and room reservations
- Experience booking
- Availability management

## Tech Stack

**Frontend:** Next.js, React, TypeScript, Tailwind CSS

**Backend:** Node.js, Express, TypeScript

**Database:** PostgreSQL on Neon

**Testing:** Vitest, React Testing Library, Supertest

**CI:** GitHub Actions

## Project Structure

- `frontend/` - Next.js application, product catalog, images and frontend tests
- `backend/` - REST API, database migrations, seeds and backend tests
- `docs/` - API, database, architecture and frontend design documentation

## Running the Backend

From the `backend` directory:

```powershell
npm.cmd install
```

Create a `.env` file inside `backend/` containing the PostgreSQL connection string:

```dotenv
DATABASE_URL=your_postgresql_connection_string
```

Start the development server:

```powershell
npm.cmd run dev
```

The API runs at `http://localhost:4000` by default.

### Available Endpoints

- `GET /api/health`
- `GET /api/products`
- `GET /api/products/:id`

Example:

```text
GET /api/products?category=clothing&sort=price_asc&page=1&limit=5
```

## Running the Frontend

From the `frontend` directory:

```powershell
npm.cmd install
npm.cmd run dev
```

The frontend runs at `http://localhost:3000`.

The product catalog is available at `http://localhost:3000/products`.

The Express backend must be running to retrieve product data.

### Product Catalog

The catalog supports category filtering, product search, sorting and pagination.

Filters are stored in URL query parameters, allowing users to share or bookmark catalog views.

Example:

```text
/products?category=toys&q=moon&sort=price_asc&page=2
```

Search queries are normalized by Next.js, which redirects URLs containing unnecessary surrounding whitespace to their clean equivalents.

The catalog includes responsive category navigation, loading skeletons, empty states and error handling.

Filtering, searching, sorting and pagination are performed by the Express backend.

## Testing

### Backend Tests

From the `backend` directory:

```powershell
npm.cmd run build
npx.cmd vitest run --coverage
```

The ordinary tests use a mocked database connection.

### PostgreSQL Integration Tests

Integration tests use a separate Neon testing branch. Add its connection string to `backend/.env`:

```dotenv
TEST_DATABASE_URL=your_testing_postgresql_connection_string
```

Then run:

```powershell
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
```

The testing database must be separate from production.

### Frontend Tests

From the `frontend` directory:

```powershell
npm.cmd run test
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

The frontend test suite uses mocked API responses and verifies catalog components and product image paths.

GitHub Actions runs frontend and backend checks automatically.

Environment files and credentials must never be committed to Git.

## Documentation

- [API Design](docs/api-design.md)
- [Backend Architecture](docs/backend-architecture.md)
- [Database Design](docs/database-design.md)
- [Frontend Catalog Design](docs/frontend-catalog-design.md)

## Status

The product catalog backend and frontend are implemented and tested.

The catalog supports category filtering, search, sorting, pagination, URL-based state management, loading states and error handling.

The next development phase will focus on individual product detail pages and additional e-commerce features.
