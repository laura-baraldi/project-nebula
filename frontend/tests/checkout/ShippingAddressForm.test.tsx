import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ShippingAddressForm from "@/components/checkout/ShippingAddressForm";
import type { ShippingDetails } from "@/lib/checkoutApi";

const shipping: ShippingDetails = {
  first_name: "Alex",
  last_name: "Smith",
  address_line1: "123 Demo Street",
  address_line2: "Apartment 4",
  city: "Stockholm",
  postal_code: "12345",
  country: "Sweden",
  phone: "0701234567",
};

describe("ShippingAddressForm", () => {
  it("renders all fields with their current values", () => {
    render(<ShippingAddressForm shipping={shipping} onChange={vi.fn()} />);

    expect(screen.getByLabelText("First name *")).toHaveValue("Alex");
    expect(screen.getByLabelText("Last name *")).toHaveValue("Smith");
    expect(screen.getByLabelText("Address *")).toHaveValue("123 Demo Street");
    expect(
      screen.getByLabelText("Apartment, suite, etc. (optional)"),
    ).toHaveValue("Apartment 4");
    expect(screen.getByLabelText("City *")).toHaveValue("Stockholm");
    expect(screen.getByLabelText("Postal code *")).toHaveValue("12345");
    expect(screen.getByLabelText("Country *")).toHaveValue("Sweden");
    expect(screen.getByLabelText("Phone number (optional)")).toHaveValue(
      "0701234567",
    );
  });

  it("marks the required fields as required", () => {
    render(<ShippingAddressForm shipping={shipping} onChange={vi.fn()} />);

    const requiredFields = [
      "First name *",
      "Last name *",
      "Address *",
      "City *",
      "Postal code *",
      "Country *",
    ];

    requiredFields.forEach((label) => {
      expect(screen.getByLabelText(label)).toBeRequired();
    });

    expect(
      screen.getByLabelText("Apartment, suite, etc. (optional)"),
    ).not.toBeRequired();
    expect(screen.getByLabelText("Phone number (optional)")).not.toBeRequired();
  });

  it("calls onChange and updates the controlled city value", async () => {
    const user = userEvent.setup();

    function TestWrapper() {
      const [currentShipping, setCurrentShipping] = React.useState(shipping);

      return (
        <ShippingAddressForm
          shipping={currentShipping}
          onChange={(field, value) => {
            setCurrentShipping((previous) => ({
              ...previous,
              [field]: value,
            }));
          }}
        />
      );
    }

    render(<TestWrapper />);

    const cityInput = screen.getByLabelText("City *");

    await user.clear(cityInput);
    await user.type(cityInput, "Gothenburg");

    expect(cityInput).toHaveValue("Gothenburg");
  });

  it("supports empty optional fields when values are undefined", () => {
    const shippingWithoutOptionalFields: ShippingDetails = {
      first_name: "",
      last_name: "",
      address_line1: "",
      city: "",
      postal_code: "",
      country: "",
    };

    render(
      <ShippingAddressForm
        shipping={shippingWithoutOptionalFields}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByLabelText("Apartment, suite, etc. (optional)"),
    ).toHaveValue("");
    expect(screen.getByLabelText("Phone number (optional)")).toHaveValue("");
  });

  it("renders the shipping address section heading", () => {
    render(<ShippingAddressForm shipping={shipping} onChange={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Shipping address" }),
    ).toBeInTheDocument();
  });

  it("calls onChange when the optional address line and phone fields change", () => {
    const onChange = vi.fn();

    render(<ShippingAddressForm shipping={shipping} onChange={onChange} />);

    fireEvent.change(
      screen.getByLabelText("Apartment, suite, etc. (optional)"),
      { target: { value: "Suite 9" } },
    );

    fireEvent.change(screen.getByLabelText("Phone number (optional)"), {
      target: { value: "0709999999" },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, "address_line2", "Suite 9");
    expect(onChange).toHaveBeenNthCalledWith(2, "phone", "0709999999");
  });
});
