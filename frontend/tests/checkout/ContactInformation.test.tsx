import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ContactInformation from "@/components/checkout/ContactInformation";

describe("ContactInformation", () => {
  it("renders the email field with its current value", () => {
    render(
      <ContactInformation email="test@example.com" onEmailChange={vi.fn()} />,
    );

    expect(screen.getByLabelText("Email address *")).toHaveValue(
      "test@example.com",
    );
  });

  it("renders an email input that is required", () => {
    render(<ContactInformation email="" onEmailChange={vi.fn()} />);

    const input = screen.getByLabelText("Email address *");

    expect(input).toHaveAttribute("type", "email");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("autocomplete", "email");
  });

  it("calls onEmailChange and updates the controlled email value", async () => {
    const user = userEvent.setup();

    function TestWrapper() {
      const [email, setEmail] = React.useState("");

      return <ContactInformation email={email} onEmailChange={setEmail} />;
    }

    render(<TestWrapper />);

    const input = screen.getByLabelText("Email address *");

    await user.type(input, "test@example.com");

    expect(input).toHaveValue("test@example.com");
  });

  it("shows the confirmation email explanation", () => {
    render(<ContactInformation email="" onEmailChange={vi.fn()} />);

    expect(
      screen.getByText("Your order confirmation will be sent to this address."),
    ).toBeInTheDocument();
  });
});
