import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { ProfessionStep } from "./profession-step";

const PROFS = [
  { slug: "graphic-designer", name: "Graphic Designer" },
  { slug: "web-developer", name: "Web Developer" },
  { slug: "ai-automation", name: "AI Automation" },
];

describe("ProfessionStep (Story 12.1)", () => {
  it("renders each real profession as a link that advances to step 2", () => {
    render(<ProfessionStep professions={PROFS} />);
    expect(
      screen.getByRole("heading", { name: /what kind of work do you do/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Graphic Designer/ }),
    ).toHaveAttribute("href", "/welcome?profession=graphic-designer");
    expect(screen.getByRole("link", { name: /Web Developer/ })).toHaveAttribute(
      "href",
      "/welcome?profession=web-developer",
    );
    expect(screen.getByRole("link", { name: /AI Automation/ })).toHaveAttribute(
      "href",
      "/welcome?profession=ai-automation",
    );
  });
});
