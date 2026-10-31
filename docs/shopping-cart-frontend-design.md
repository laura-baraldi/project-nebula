# Shopping Cart — Frontend Design

## 1. Overview

The shopping cart frontend uses Next.js, React, TypeScript and Tailwind CSS.

It communicates with the existing Express Shopping Cart API.

The frontend does not access PostgreSQL directly or manage secret cart tokens.

The cart interface includes Add to Cart controls, a dedicated cart page, quantity controls, item removal and cart navigation. Checkout is implemented separately at `/checkout`.

## 2. Goals

- Allow visitors to add products to their cart.
- Display cart contents and current totals.
- Allow quantity updates and item removal.
- Preserve cart contents across refreshes.
- Handle stock changes and unavailable products.
- Provide a checkout flow and order confirmation.
- Maintain the existing responsive pastel-purple design.

## 3. Pages and Components

### Product Catalog and Details

- Display an Add to Cart button.
- Disable adding products with no available stock.
- Show loading, success and error feedback.
- Prevent repeated submissions while a request is pending.
- Use the backend response to update cart-related UI state.

### Cart Page — `/cart`

Display:

- Product image and name.
- Unit price in Pawstars.
- Quantity controls.
- Item subtotal.
- Availability status.
- Remove button.
- Cart total.
- Empty cart state.
- Loading and error states.

Provide links back to the product catalog and to checkout when the cart contains items.

Quantity changes and item removal must use the corresponding backend API operations. The UI must reflect the returned cart rather than calculating authoritative prices or totals independently.

### Checkout Page — `/checkout`

The checkout page loads the existing guest cart and collects:

- Customer email.
- First and last name.
- Shipping address.
- City, postal code and country.
- Optional address details and phone number.

The page has two steps:

1. Contact and shipping information.
2. Simulated payment confirmation.

The page clearly states that no real payment is processed and asks users not to enter real personal information. Submitted demo details are stored in the database.

The payment step displays a fictional demo card. No card details are collected.

### Order Confirmation

After successful checkout, the confirmation screen displays:

- Order number.
- Confirmation email address.
- Purchased products and quantities.
- Total in Pawstars.
- Notice that payment was simulated.

The user can return to the product catalog.

### Cart Navigation

Cart update notifications allow interested components to respond when cart data changes.

## 4. API Integration

| Action          | API                                 |
| --------------- | ----------------------------------- |
| Load cart       | GET `/api/cart`                     |
| Add product     | POST `/api/cart/items`              |
| Change quantity | PATCH `/api/cart/items/:productId`  |
| Remove product  | DELETE `/api/cart/items/:productId` |
| Create order    | POST `/api/cart/checkout`           |

The `lib/cartApi.ts` module centralizes cart API calls and error handling.

The `lib/checkoutApi.ts` module handles checkout requests and checkout errors.

Browser requests use `credentials: "include"`.

The cart token is stored in an HttpOnly cookie and is never read by frontend JavaScript.

The backend remains responsible for validation, prices, totals and stock rules.

## 5. Quantity and Availability Rules

- Minimum quantity: 1.
- Maximum quantity: 20 per product.
- POST increases quantity.
- PATCH replaces quantity.
- DELETE removes the item.
- Unavailable products remain visible in the cart.
- Visitors may reduce or remove unavailable products.
- Increasing unavailable products is not allowed.
- Frontend validation improves usability but does not replace backend validation.
- Checkout rechecks availability and stock on the backend.

## 6. State and Error Handling

- Display a loading state while retrieving the cart.
- Update displayed cart data using successful API responses.
- Do not assume a modification succeeded before confirmation.
- Keep the previous cart state when a request fails.
- Show useful feedback for stock conflicts and unavailable products.
- Allow retrying failed operations.
- Refreshing the page retrieves the persisted cart from the backend.
- The first implementation does not use localStorage for cart persistence.
- After successful checkout, update the frontend cart state to an empty cart.
- Display the order confirmation using the order returned by the backend.
- If checkout fails, display the API error and allow the user to retry.

## 7. Security and Deployment

- Use browser-managed cookies.
- Never expose the cart token in URLs or JavaScript.
- Keep the API URL configurable for different environments.
- Verify CORS, trusted Origin and cookie behavior when deploying.
- Preserve backend validation and authorization boundaries.
- Do not collect real card details.
- The checkout page warns users not to submit real personal information.

## 8. Testing

Automated frontend tests should cover:

- API client requests and errors.
- Add to Cart loading, success and failure.
- Quantity updates and item removal.
- Empty cart rendering.
- Unavailable items and stock conflicts.
- Cart loading and retry behavior.
- Cart navigation and update notifications.
- Checkout form and validation behavior.
- Checkout API success and error handling.
- Simulated payment step.
- Order confirmation rendering.
- Cart state after successful checkout.
- Component behavior and accessible controls.

Use Vitest, React Testing Library and mocked API responses for isolated component tests.

Real browser-to-backend integration must be verified separately. Passing mocked component tests does not prove that browser cookies, CORS, API configuration and backend requests work together.

## 9. Implementation Plan

- [x] Create `lib/cartApi.ts`.
- [x] Add API client tests.
- [x] Implement Add to Cart controls.
- [x] Create the `/cart` page.
- [x] Implement quantity controls and item removal.
- [x] Add cart navigation and update notifications.
- [x] Add component tests for cart behavior.
- [x] Implement the `/checkout` page.
- [x] Implement contact and shipping forms.
- [x] Implement the simulated payment step.
- [x] Implement the order confirmation screen.
- [x] Connect checkout to the backend API.
- [ ] Verify the complete cart and checkout flow in a browser connected to the backend.
- [ ] Verify all frontend tests, lint, TypeScript and production build.
- [x] Update README and related documentation.
- [ ] Open and merge the frontend pull request.

## 10. Out of Scope

- Customer accounts.
- Real payment processing.
- Shipping integrations.
- Inventory reservation.
- Cross-device cart synchronization.

These features will be addressed separately.
