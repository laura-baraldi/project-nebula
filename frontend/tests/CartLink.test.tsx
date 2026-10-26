import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CartLink from "@/components/CartLink";

describe("CartLink", () => {
  it("links to the shopping cart page", () => {
    render(<CartLink />);

    expect(
      screen.getByRole("link", { name: "View shopping cart" }),
    ).toHaveAttribute("href", "/cart");
  });

  it("displays the cart label", () => {
    render(<CartLink />);

    expect(screen.getByText("Cart")).toBeInTheDocument();
  });
});
