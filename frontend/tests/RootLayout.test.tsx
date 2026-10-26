import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";

// Mock Next.js fonts to avoid loading Google Fonts during tests.
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "mock-geist-sans" }),
  Geist_Mono: () => ({ variable: "mock-geist-mono" }),
}));

describe("RootLayout", () => {
  it("renders the cart link in the global navigation", () => {
    render(
      <RootLayout params={Promise.resolve({})}>
        <div>Test page content</div>
      </RootLayout>,
    );

    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "View shopping cart" }),
    ).toHaveAttribute("href", "/cart");

    expect(screen.getByText("Test page content")).toBeInTheDocument();
  });

  it("aligns the navigation to the right without a width limit", () => {
    const { container } = render(
      <RootLayout params={Promise.resolve({})}>
        <div>Test page content</div>
      </RootLayout>,
    );

    const navigation = container.querySelector(
      'nav[aria-label="Main navigation"]',
    );

    expect(navigation).toHaveClass("justify-end");
    expect(navigation).not.toHaveClass("max-w-6xl");
  });
});
