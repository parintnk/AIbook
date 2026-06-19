import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { GoalStep } from "./goal-step";

describe("GoalStep (Story 12.1)", () => {
  it("renders the goals as links carrying profession + goal, plus a change-profession link", () => {
    render(
      <GoalStep
        professionSlug="graphic-designer"
        professionName="Graphic Designer"
      />,
    );
    // a goal link carries both params
    expect(
      screen.getByRole("link", { name: /Deliver client work faster/ }),
    ).toHaveAttribute(
      "href",
      "/welcome?profession=graphic-designer&goal=deliver-faster",
    );
    expect(
      screen.getByRole("link", { name: /Learn a new skill/ }),
    ).toHaveAttribute(
      "href",
      "/welcome?profession=graphic-designer&goal=learn-skill",
    );
    // the chosen profession is confirmed with a "change" link back to step 1
    const change = screen.getByRole("link", {
      name: /Graphic Designer · change/,
    });
    expect(change).toHaveAttribute("href", "/welcome");
  });
});
