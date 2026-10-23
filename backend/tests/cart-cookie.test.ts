import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import {
  CART_COOKIE_MAX_AGE,
  CART_COOKIE_NAME,
  clearCartCookie,
  readCartToken,
  setCartCookie,
} from "../src/cart-cookie.js";

import { generateCartToken } from "../src/cart-token.js";

// A small Express app used only for testing.
// No real database or running server is needed.
function createTestApp() {
  const app = express();

  app.get("/api/cart/read", (req, res) => {
    res.json({ token: readCartToken(req) });
  });

  app.get("/api/cart/set", (_req, res) => {
    setCartCookie(res, generateCartToken());
    res.status(200).json({ success: true });
  });

  app.get("/api/cart/clear", (_req, res) => {
    clearCartCookie(res);
    res.status(200).json({ success: true });
  });

  return app;
}

const app = createTestApp();

describe("Cart cookie handling", () => {
  it("returns null when no cookie is provided", async () => {
    const response = await request(app).get("/api/cart/read");

    expect(response.status).toBe(200);
    expect(response.body.token).toBeNull();
  });

  it("reads a valid cart token from the Cookie header", async () => {
    const token = generateCartToken();

    const response = await request(app)
      .get("/api/cart/read")
      .set("Cookie", `${CART_COOKIE_NAME}=${token}`);

    expect(response.body.token).toBe(token);
  });

  it("finds the cart token among other cookies", async () => {
    const token = generateCartToken();

    const response = await request(app)
      .get("/api/cart/read")
      .set("Cookie", `theme=dark; ${CART_COOKIE_NAME}=${token}; lang=it`);

    expect(response.body.token).toBe(token);
  });

  it("rejects malformed cart tokens", async () => {
    const response = await request(app)
      .get("/api/cart/read")
      .set("Cookie", `${CART_COOKIE_NAME}=invalid-token`);

    expect(response.body.token).toBeNull();
  });

  it("sets a secure HttpOnly cookie with a seven-day lifetime", async () => {
    const response = await request(app).get("/api/cart/set");

    const cookie = response.headers["set-cookie"]?.[0];

    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/^cart_token=[0-9a-f]{64};/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/cart");
    expect(cookie).toContain(`Max-Age=${CART_COOKIE_MAX_AGE / 1000}`);

    // Secure must be enabled in production.
    if (process.env.NODE_ENV === "production") {
      expect(cookie).toContain("Secure");
    }
  });

  it("clears the cart cookie using the same path", async () => {
    const response = await request(app).get("/api/cart/clear");

    const cookie = response.headers["set-cookie"]?.[0];

    expect(cookie).toBeDefined();
    expect(cookie).toContain("cart_token=");
    expect(cookie).toContain("Path=/api/cart");
    const expires = cookie?.match(/Expires=([^;]+)/)?.[1];

    expect(expires).toBeDefined();
    expect(new Date(expires!).getTime()).toBeLessThan(Date.now());
  });

  it("ignores cookies without an equals sign", async () => {
    const token = generateCartToken();

    // "brokenCookie" has no "=" and must be skipped.
    // The parser should continue looking for cart_token.
    const response = await request(app)
      .get("/api/cart/read")
      .set("Cookie", `brokenCookie; ${CART_COOKIE_NAME}=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.token).toBe(token);
  });

  it("returns null when other cookies exist but cart_token is missing", async () => {
    const response = await request(app)
      .get("/api/cart/read")
      .set("Cookie", "theme=dark; lang=it");

    expect(response.status).toBe(200);
    expect(response.body.token).toBeNull();
  });
});
