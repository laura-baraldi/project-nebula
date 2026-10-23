# Product Detail Pages — Frontend Design

## 1. Overview

Product detail pages allow users to view additional information about individual products.

The frontend uses Next.js, React, TypeScript and Tailwind CSS, retrieving product data from the existing Express REST API.

This feature builds on the completed product catalog without introducing cart or checkout functionality.

## 2. Goals

- Allow users to navigate from the catalog to an individual product.
- Display complete product information.
- Provide a responsive product detail layout.
- Handle unavailable and nonexistent products.
- Maintain the existing pastel-purple visual identity.
- Reuse the existing backend API and product images.

## 3. Routes and Navigation

### Product Detail Route

Dynamic Next.js route:

`/products/[id]`

Examples:

- `/products/1`
- `/products/12`
- `/products/30`

The route parameter represents the product ID returned by the backend.

### Catalog Navigation

Each product card links to its corresponding detail page.

Example:

`/products/12`

The detail page provides a link back to the product catalog.

### Navigation Behavior

- Use Next.js `Link` for internal navigation.
- Keep product IDs as strings to avoid JavaScript integer precision issues.
- Do not construct product detail URLs using product names.
- Preserve existing catalog filtering, sorting and pagination behavior.

## 4. Product Information

The detail page displays:

- Product name
- Product image
- Category
- Description
- Price in Pawstars (PWS)
- Stock availability

The backend already provides the necessary fields.

### Stock Availability

Initially, availability is displayed as:

- `In stock` when `stock_quantity > 0`.
- `Out of stock` when `stock_quantity = 0`.

Exact stock quantities are not displayed to customers.

No purchasing functionality is included in this feature.

## 5. Layout and Responsive Design

### Desktop

- Large product image on the left.
- Product information on the right.
- Clear visual hierarchy for product name and price.
- Comfortable spacing and readable descriptions.

### Mobile and Tablet

- Product image appears above product information.
- Content adapts to the available screen width.
- No horizontal scrolling.
- Navigation links remain accessible.

### Visual Style

- Minimal editorial design with a pastel-purple background.
- Large product image on the left and product information on the right on desktop.
- Product image above the information on smaller screens.
- Spacious typography, subtle separators and rounded image corners.
- Stock availability displayed using a colored badge.
- Reuse existing product images.
- Maintain adequate text contrast and accessibility.

## 6. Backend Integration

Existing endpoint:

`GET /api/products/:id`

Example:

`GET http://localhost:4000/api/products/12`

### Successful Response

HTTP `200 OK` returns the requested product.

Relevant fields:

- `id`
- `name`
- `description`
- `price_pawstars`
- `category`
- `stock_quantity`
- `image_url`

### Error Responses

- `400 INVALID_PRODUCT_ID`: invalid product ID.
- `404 PRODUCT_NOT_FOUND`: product does not exist or is inactive.
- `500 INTERNAL_SERVER_ERROR`: unexpected server error.

The Next.js frontend does not query PostgreSQL directly.

No database schema changes are required.

## 7. Error Handling

### Product Not Found

When the backend returns HTTP 404, the frontend displays a dedicated not-found page.

Use Next.js `notFound()`.

The page includes a link back to the product catalog.

### Invalid Product ID

Invalid product IDs are treated as unavailable product pages in the frontend.

The backend continues to enforce its own ID validation.

### API Errors

Unexpected API failures display an error message with a retry option.

### Loading State

Display a loading skeleton while product information is being retrieved.

## 8. Component Architecture

Implemented route structure:

```text
frontend/
  app/
    products/
      page.tsx
      error.tsx
      [id]/
        page.tsx
        loading.tsx
        not-found.tsx
```

The product detail page is a Next.js Server Component.

Product cards use Next.js Link to navigate to individual detail pages.

The product detail route validates the ID before requesting data from Express.

Invalid IDs and missing or inactive products trigger Next.js notFound().

The product detail loading skeleton follows the same responsive layout as the page.

Unexpected API and network errors are handled by the shared products/error.tsx boundary, which provides a retry action.

A separate [id]/error.tsx is not required.

## 9. Testing

Automated tests should cover:

- Product card navigation.
- Correct product ID in the generated link.
- Successful product detail API requests.
- Product information rendering.
- Price and image display.
- In-stock and out-of-stock states.
- Invalid product IDs.
- Missing or inactive products.
- API errors.
- Loading state.
- Navigation back to the catalog.

Tests use Vitest and React Testing Library.

Existing catalog tests must continue to pass.

## 10. Out of Scope

This feature does not include:

- Shopping cart
- Add to cart functionality
- Checkout or payments
- Authentication
- Product reviews
- Product image galleries
- Related product recommendations
- Inventory management

These features may be implemented separately.

## 11. Implementation Status

1. [x] Update product cards with detail links.
2. [x] Create the dynamic product detail route.
3. [x] Integrate the existing product details API.
4. [x] Implement responsive product information layout.
5. [x] Implement stock availability display.
6. [x] Implement not-found, loading and error states.
7. [x] Add automated tests.
8. [x] Validate frontend tests, coverage, lint, TypeScript and production build.
9. [x] Update project documentation.
10. [ ] Open and merge the pull request.

```

```
