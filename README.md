# Project Nebula

A fictional full-stack booking and e-commerce platform set on a planet inhabited by hairless cats.

The project is being developed to practice full-stack software development, API design, SQL, testing and frontend-backend communication.

All purchases and payments are simulated.

## Features

### Implemented

- Product catalog REST API
- Product details
- Category and price filtering
- Case-insensitive product search
- Sorting and server-side pagination
- PostgreSQL database with 30 sample products
- Database migrations
- Automated backend tests
- PostgreSQL integration tests
- GitHub Actions for backend build and testing

### Planned

- Product catalog frontend
- Shopping cart
- Stock availability and inventory management
- Orders
- Simulated checkout and payments

### Future Expansion

- Hotel and room reservations
- Experience booking
- Availability management

## Tech Stack

**Frontend:** Next.js, React, TypeScript, Tailwind CSS (planned)

**Backend:** Node.js, Express, TypeScript

**Database:** PostgreSQL on Neon

**Testing:** Vitest, Supertest

**CI:** GitHub Actions

## Project Structure

- `frontend/` - Web application (planned)
- `backend/` - REST API, database migrations, seeds and tests
- `docs/` - API and database documentation

## Running the Backend

From the `backend` directory:

```powershell
npm ci
```

Create a `.env` file inside `backend/` containing the PostgreSQL connection string:

```dotenv
DATABASE_URL=your_postgresql_connection_string
```

Start the development server:

```powershell
npm run dev
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

## Testing

Run the backend build and ordinary tests:

```powershell
npm run build
npx vitest run --coverage
```

The ordinary tests use a mocked database connection.

Integration tests use a separate Neon testing branch. Add its connection string to `backend/.env`:

```dotenv
TEST_DATABASE_URL=your_testing_postgresql_connection_string
```

Then run:

```powershell
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
```

The testing database must be separate from production.

Environment files and credentials must never be committed to Git.

## Documentation

- [API Design](docs/api-design.md)
- [Database Design](docs/database-design.md)

## Status

Product catalog backend API implemented and tested.

Frontend development and additional e-commerce functionality are planned.
