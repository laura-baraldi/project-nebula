# Frontend Catalog Design — Project Nebula

## 1. Overview

The product catalog is built with Next.js, React, TypeScript and Tailwind CSS. Product data is retrieved from the existing Express REST API.

This document describes the planned frontend behavior and design decisions for product discovery.

## 2. Goals

- Allow users to browse products by category.
- Provide product search by name.
- Support sorting by price, name and creation date.
- Display paginated results.
- Keep navigation state in URL query parameters.
- Maintain the existing responsive, pastel-purple visual identity.

## 3. Catalog Layout

The catalog page contains:

1. A page heading and introductory description.
2. A product search field.
3. Category filters.
4. A sorting control and result count.
5. A responsive product grid.
6. Pagination controls.

On desktop, category filters appear in a persistent left sidebar, with the product grid on the right.

On mobile and tablet, category filters appear in a collapsible "Categories" menu above the product grid.

Both the desktop sidebar and the collapsible mobile menu use the same category navigation. Only their presentation differs.

The existing `ProductCard` component remains responsible for displaying individual product information.

## 4. Category Filtering

Supported categories:

| Display Label | API Value     |
| ------------- | ------------- |
| Clothing      | `clothing`    |
| Home          | `home`        |
| Skincare      | `skincare`    |
| Technology    | `tech`        |
| Toys          | `toys`        |
| Food          | `food`        |
| Accessories   | `accessories` |
| Travel        | `travel`      |

"All Products" is the default selection and removes the category parameter.

Only one category can be selected at a time.

The selected category must remain visually distinguishable.

## 5. Product Search

Search uses the backend `q` parameter.

- Users can search products by name.
- Leading and trailing whitespace is removed.
- Empty searches remove the `q` parameter.
- Search input is limited to 100 characters.
- Search submissions reset pagination to page 1.
- Search can be combined with category filtering and sorting.

Search is submitted explicitly rather than sending an API request on every keystroke.

Search queries are normalized by Next.js before being sent to the Express API.

If the search query contains leading or trailing whitespace, Next.js redirects to a clean catalog URL.

Empty or whitespace-only searches remove the `q` parameter from the URL.

URL normalization preserves valid category, sorting and pagination parameters.

## 6. Product Sorting

Supported options:

| Label              | API Value    |
| ------------------ | ------------ |
| Newest             | `newest`     |
| Price: Low to High | `price_asc`  |
| Price: High to Low | `price_desc` |
| Name: A to Z       | `name_asc`   |

The default sorting method is `newest`.

Changing the sorting method resets pagination to page 1 and preserves active filters.

## 7. Pagination

- Display up to 20 products per page.
- Use the backend `page`, `limit`, `total` and `totalPages` values.
- Provide Previous and Next navigation controls.
- Disable navigation when the relevant page is unavailable.
- Preserve filters and sorting when changing pages.
- Reset to page 1 when filters, search or sorting change.

## 8. URL State

URL query parameters are the source of truth for the catalog state.

Example:

`/products?category=toys&q=moon&sort=price_asc&page=2`

Default values may be omitted from the URL.

Invalid or unsupported parameters must be handled safely.

The URL can be shared or bookmarked without losing the selected catalog state.

Search URLs are canonicalized when necessary.

For example:

- `/products?q=+++moon+++` redirects to `/products?q=moon`.
- `/products?q=+++` redirects to `/products`.
- `/products?category=toys&q=++moon++` redirects to `/products?category=toys&q=moon`.

The redirect occurs before fetching product data from Express, avoiding an unnecessary API request.

## 9. User Experience

### Loading State

Display a loading indicator while catalog data is being retrieved.

### Empty Results

Display a friendly message when no products match the selected criteria, with an option to clear filters.

### Error State

Display an appropriate error message when the catalog cannot be loaded.

### Responsive Design

- Mobile (below 640px): one-column product grid with a collapsible "Categories" menu.
- Tablet (640–1023px): two-column product grid with a collapsible "Categories" menu.
- Medium desktop (1024–1279px): persistent left category sidebar and two-column product grid.
- Large desktop (1280px and above): persistent left category sidebar and three-column product grid.

Search, category filters and sorting controls must remain usable on smaller screens.

## 10. Architecture

- Next.js reads and validates URL parameters.
- Express performs filtering, sorting and pagination.
- PostgreSQL provides product data.
- The frontend does not query PostgreSQL directly.
- Existing product cards and image assets are reused.
- No database schema changes are required.

## 11. Testing

Automated tests must cover:

- Category selection and clearing.
- Search submission and empty searches.
- Sorting options.
- Combined query parameters.
- Pagination navigation.
- Resetting pagination when filters change.
- Empty results.
- Invalid URL parameters.
- API errors.
- Preservation of existing product card behavior.

Tests should run in the existing Frontend CI workflow.

## 12. Out of Scope

The following features are not part of this branch:

- Individual product detail pages.
- Shopping cart.
- User authentication.
- Checkout and payments.
- Advanced multi-category filtering.
- Price range controls.
- End-to-end browser testing.

These features will be implemented separately.
