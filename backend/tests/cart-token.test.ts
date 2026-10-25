import { describe, expect, it } from "vitest";
import { generateCartToken, hashCartToken } from "../src/cart-token.js";

describe("Cart token security", () => {
  it("generates a 64-character hexadecimal token", () => {
    const token = generateCartToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates different tokens", () => {
    const first = generateCartToken();
    const second = generateCartToken();

    expect(first).not.toBe(second);
  });

  it("generates a 64-character SHA-256 hash", () => {
    const token = generateCartToken();
    const hash = hashCartToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
  });

  it("returns the same hash for the same token", () => {
    const token = generateCartToken();

    expect(hashCartToken(token)).toBe(hashCartToken(token));
  });

  it("returns different hashes for different tokens", () => {
    const first = generateCartToken();
    const second = generateCartToken();

    expect(hashCartToken(first)).not.toBe(hashCartToken(second));
  });
});
