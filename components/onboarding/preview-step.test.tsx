import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { WorkflowCardData } from "@/lib/explore";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/components/workflows/workflow-card", () => ({
  WorkflowCard: ({ data }: { data: { title: string } }) => (
    <div data-testid="wfcard">{data.title}</div>
  ),
}));
vi.mock("@/components/auth/oauth-buttons", () => ({
  OAuthButtons: ({ next }: { next: string }) => (
    <button type="button">Continue with Google · {next}</button>
  ),
}));

import { PreviewStep } from "./preview-step";

function wf(id: string, title: string): WorkflowCardData {
  return { id, title } as WorkflowCardData;
}

describe("PreviewStep (Story 12.1)", () => {
  it("renders the preview cards + the sign-up zone carrying the pick", () => {
    render(
      <PreviewStep
        professionName="Graphic Designer"
        goalTitle="Deliver client work faster"
        workflows={[wf("a", "Brand kit recipe"), wf("b", "Icon set recipe")]}
        signupNext="/explore?profession=graphic-designer"
      />,
    );
    // 2 preview cards
    expect(screen.getAllByTestId("wfcard")).toHaveLength(2);
    expect(screen.getByText("Brand kit recipe")).toBeInTheDocument();
    // Google sign-up carries the next; Email link encodes it
    expect(
      screen.getByRole("button", { name: /Continue with Google/ }),
    ).toHaveTextContent("/explore?profession=graphic-designer");
    expect(
      screen.getByRole("link", { name: /Continue with Email/ }),
    ).toHaveAttribute(
      "href",
      `/sign-up?next=${encodeURIComponent("/explore?profession=graphic-designer")}`,
    );
    // the persist hint shows the profession + goal (copy only — real persist = 12.2); the goal title
    // also appears in the preview note → it renders in both places.
    expect(screen.getByText(/We'll remember/)).toBeInTheDocument();
    expect(screen.getAllByText("Deliver client work faster")).toHaveLength(2);
  });

  it("falls back to a 'browse all workflows' link when there are no matches", () => {
    render(
      <PreviewStep
        professionName="AI Automation"
        goalTitle="Learn a new skill"
        workflows={[]}
        signupNext="/explore?profession=ai-automation"
      />,
    );
    expect(screen.queryByTestId("wfcard")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /browse all workflows/i }),
    ).toHaveAttribute("href", "/explore");
  });
});
