import { describe, expect, it } from "vitest";
import request from "supertest";
import { vi } from "vitest";
import type { Request, Response } from "express";
import { cartSecurity } from "../src/cart-security.js";

// This test checks HTTP security, not PostgreSQL.
// Replace the database pool with a mock.
vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

// The test only checks HTTP security behavior.
// None of these requests needs a real database.
import { app } from "../src/app.js";

const TRUSTED_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

const UNTRUSTED_ORIGIN = "https://malicious.example";

describe("Cart CORS and CSRF security", () => {
  it("allows preflight requests from the trusted frontend", async () => {
    const response = await request(app)
      .options("/api/cart/items")
      .set("Origin", TRUSTED_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    // The cors library handles the preflight.
    // No product is added at this stage.
    expect(response.status).toBe(204);

    expect(response.headers["access-control-allow-origin"]).toBe(
      TRUSTED_ORIGIN,
    );

    expect(response.headers["access-control-allow-credentials"]).toBe("true");

    expect(response.headers["access-control-allow-methods"]).toContain("POST");

    expect(
      response.headers["access-control-allow-headers"].toLowerCase(),
    ).toContain("content-type");
  });

  it("does not authorize an untrusted origin through CORS", async () => {
    const response = await request(app)
      .options("/api/cart/items")
      .set("Origin", UNTRUSTED_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    // With our static cors configuration, the middleware may
    // still return 204, but it must not authorize this origin.
    expect(response.headers["access-control-allow-origin"]).not.toBe(
      UNTRUSTED_ORIGIN,
    );
  });

  it("rejects a POST from an untrusted origin", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", UNTRUSTED_ORIGIN)
      .send({ product_id: "1", quantity: 2 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects a POST without an Origin header", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .send({ product_id: "1", quantity: 2 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("allows a trusted POST to reach request validation", async () => {
    const response = await request(app)
      .post("/api/cart/items")
      .set("Origin", TRUSTED_ORIGIN)
      .send({ product_id: "1", quantity: 25 });

    // 400 proves that the security middleware allowed
    // the request to reach the POST validation logic.
    // Quantity 25 is invalid, so no database write occurs.
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    expect(response.headers["access-control-allow-origin"]).toBe(
      TRUSTED_ORIGIN,
    );

    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows GET without an Origin header", async () => {
    const response = await request(app).get("/api/cart");

    // No cookie means an empty cart, without a database query.
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [],
      total_pawstars: 0,
    });
  });

  it("allows HEAD requests without an Origin header", async () => {
    const response = await request(app).head("/api/cart");

    expect(response.status).toBe(200);
  });

  it("allows OPTIONS requests to continue without CSRF validation", () => {
    // Test the middleware directly because the cors library
    // normally handles OPTIONS before cartSecurity receives it.

    const req = {
      method: "OPTIONS",
      headers: {
        origin: "https://malicious.example",
      },
    } as Request;

    const res = {} as Response;

    // Mock the next() function provided by Express.
    const next = vi.fn();

    cartSecurity(req, res, next);

    // OPTIONS must continue without being rejected by CSRF checks.
    expect(next).toHaveBeenCalledOnce();
  });
});
