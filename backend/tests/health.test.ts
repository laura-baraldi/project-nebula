import { describe, expect, it, vi } from "vitest";
import request from "supertest";

// Mock the database pool so tests do not require a real database.
vi.mock("../src/db/pool.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { app } from "../src/app.js";

describe("GET /api/health", () => {
  it("returns HTTP 200 and confirms the API is running", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
    });
  });
});
