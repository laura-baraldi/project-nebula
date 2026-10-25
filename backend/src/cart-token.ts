import { createHash, randomBytes } from "node:crypto";

// A cart token contains 32 cryptographically secure random bytes.
// Converting them to hexadecimal produces a 64-character string.
export function generateCartToken(): string {
  return randomBytes(32).toString("hex");
}

// Never store the original cart token in PostgreSQL.
// Store its SHA-256 hash instead.
//
// When a browser sends its cookie, we hash the received token
// and use the result to find the corresponding cart.
export function hashCartToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
