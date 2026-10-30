import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: sendMock,
    };
  },
}));

import { sendOrderConfirmationEmail } from "../src/email/email.service.js";

describe("sendOrderConfirmationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_FROM = "onboarding@resend.dev";
  });

  it("sends an order confirmation email successfully", async () => {
    sendMock.mockResolvedValueOnce({
      data: { id: "email-123" },
      error: null,
    });

    await expect(
      sendOrderConfirmationEmail("customer@example.com", "ORD-123"),
    ).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith({
      from: "onboarding@resend.dev",
      to: "customer@example.com",
      subject: "Order confirmation – ORD-123",
      html: expect.stringContaining("ORD-123"),
    });
  });

  it("throws an error when Resend returns an error", async () => {
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Invalid recipient",
      },
    });

    await expect(
      sendOrderConfirmationEmail("customer@example.com", "ORD-123"),
    ).rejects.toThrow(
      "Failed to send order confirmation email: Invalid recipient",
    );

    expect(sendMock).toHaveBeenCalledOnce();
  });

  it("propagates unexpected exceptions from Resend", async () => {
    sendMock.mockRejectedValueOnce(new Error("Network failure"));

    await expect(
      sendOrderConfirmationEmail("customer@example.com", "ORD-123"),
    ).rejects.toThrow("Network failure");
  });
});
