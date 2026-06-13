import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/nav/search-trigger", () => ({
  SearchTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));
const pathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

import { BottomTabBar } from "./bottom-tab-bar";

describe("BottomTabBar", () => {
  it("renders the 5 tabs", () => {
    render(<BottomTabBar />);
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /notifications/i }),
    ).toBeInTheDocument();
    // Search is rendered via the (mocked) SearchTrigger.
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("marks the active tab with aria-current", () => {
    render(<BottomTabBar />);
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
