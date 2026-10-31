import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not defined");
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("Testing and application databases must be different");
}

describe("Orders database integration", () => {
  let client: Client;

  beforeEach(async () => {
    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();
    await client.query("BEGIN");
  });

  afterEach(async () => {
    await client.query("ROLLBACK");
    await client.end();
  });

  const validOrder = {
    customer_email: `test-${randomUUID()}@example.com`,
    first_name: "Laura",
    last_name: "Baraldi",
    address_line1: "Via Roma 1",
    address_line2: "Apartment 2",
    city: "Milano",
    postal_code: "20100",
    country: "Italy",
    phone: "+39 123456789",
    total_pawstars: 200,
  };

  async function insertOrder(overrides: Record<string, unknown> = {}) {
    const values = { ...validOrder, ...overrides };

    return client.query(
      `INSERT INTO orders (
        customer_email,
        first_name,
        last_name,
        address_line1,
        address_line2,
        city,
        postal_code,
        country,
        phone,
        total_pawstars
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        values.customer_email,
        values.first_name,
        values.last_name,
        values.address_line1,
        values.address_line2,
        values.city,
        values.postal_code,
        values.country,
        values.phone,
        values.total_pawstars,
      ],
    );
  }

  async function expectConstraintError(
    overrides: Record<string, unknown>,
    code: string,
  ) {
    await client.query("SAVEPOINT before_invalid_order");

    try {
      await expect(insertOrder(overrides)).rejects.toMatchObject({ code });
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT before_invalid_order");
      await client.query("RELEASE SAVEPOINT before_invalid_order");
    }
  }

  it("stores all required and optional shipping details", async () => {
    const result = await insertOrder();

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      ...validOrder,
      status: "confirmed",
      payment_status: "simulated",
    });
    expect(result.rows[0].order_number).toMatch(/^ORD-\d{8}$/);
  });

  it("accepts NULL for optional shipping details", async () => {
    const result = await insertOrder({
      address_line2: null,
      phone: null,
    });

    expect(result.rows[0].address_line2).toBeNull();
    expect(result.rows[0].phone).toBeNull();
  });

  it.each([
    "first_name",
    "last_name",
    "address_line1",
    "city",
    "postal_code",
    "country",
  ])("rejects NULL for required field %s", async (field) => {
    await expectConstraintError({ [field]: null }, "23502");
  });

  it.each([
    "first_name",
    "last_name",
    "address_line1",
    "city",
    "postal_code",
    "country",
  ])("rejects blank values for required field %s", async (field) => {
    await expectConstraintError({ [field]: "   " }, "23514");
  });
});
