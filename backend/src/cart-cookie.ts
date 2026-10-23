import type { Request, Response } from "express";

// The cookie is valid for seven days.
export const CART_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const CART_COOKIE_NAME = "cart_token";

// Read the token from the incoming Cookie header.
export function readCartToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  // A Cookie header may contain multiple cookies,
  // separated by semicolons.
  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const name = cookie.slice(0, separator).trim();
    const value = cookie.slice(separator + 1).trim();

    if (name === CART_COOKIE_NAME) {
      // Our generated tokens are exactly 64 hexadecimal characters.
      // Reject malformed or manually modified token values.
      return /^[0-9a-f]{64}$/.test(value) ? value : null;
    }
  }

  return null;
}

// Instruct the browser to store the original cart token.
export function setCartCookie(res: Response, token: string): void {
  res.cookie(CART_COOKIE_NAME, token, {
    httpOnly: true,

    // Browser sends the cookie on same-site requests.
    sameSite: "lax",

    // HTTPS-only cookies in production.
    secure: process.env.NODE_ENV === "production",

    // The cookie is only needed by our cart API.
    path: "/api/cart",

    maxAge: CART_COOKIE_MAX_AGE,
  });
}

// Remove the cookie when it is no longer usable.
export function clearCartCookie(res: Response): void {
  res.clearCookie(CART_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/cart",
  });
}
