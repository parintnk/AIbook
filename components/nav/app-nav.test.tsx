import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the interactive children (they pull next-themes / supabase / base-ui) so
// this test focuses on the nav structure + active link.
vi.mock("@/components/nav/avatar-menu", () => ({
  AvatarMenu: () => <div data-testid="avatar-menu" />,
}));
vi.mock("@/components/nav/notifications-bell", () => ({
  NotificationsBell: () => <div data-testid="bell" />,
}));
vi.mock("@/components/nav/search-trigger", () => ({
  SearchTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="search">{children}</div>
  ),
}));

const pathname = vi.fn(() => "/explore");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

import { AppNav } from "./app-nav";

describe("AppNav", () => {
  it("renders the brand, the 4 primary links, search, and bell", () => {
    render(<AppNav />);
    expect(
      screen.getByRole("link", { name: "idea — home" }),
    ).toBeInTheDocument();
    for (const label of ["Explore", "Communities", "Forked", "Saved"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByTestId("search").length).toBeGreaterThan(0);
    expect(screen.getByTestId("bell")).toBeInTheDocument();
    expect(screen.getByTestId("avatar-menu")).toBeInTheDocument();
  });

  it("marks the active link with aria-current", () => {
    render(<AppNav />);
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Communities" }),
    ).not.toHaveAttribute("aria-current");
  });
});
