import type { Request, Response, NextFunction } from "express";

// The only frontend allowed to make cart modifications.
// In production, configure FRONTEND_ORIGIN with the real HTTPS URL.
const trustedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

// CSRF protection for requests that modify the cart.
// CORS is configured separately in app.ts.
export function cartSecurity(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // GET and HEAD only read data, so they do not require
  // the Origin check used for state-changing requests.
  if (req.method === "GET" || req.method === "HEAD") {
    next();
    return;
  }

  // OPTIONS preflight requests are handled by the cors library.
  if (req.method === "OPTIONS") {
    next();
    return;
  }

  // Browsers send Origin when making cross-origin requests.
  // A malicious website must not modify another site's cart.
  const origin = req.headers.origin;

  if (origin !== trustedOrigin) {
    res.status(403).json({
      error: {
        code: "FORBIDDEN_ORIGIN",
        message: "Request origin is not allowed.",
      },
    });
    return;
  }

  next();
}
