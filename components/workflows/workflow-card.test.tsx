import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkflowCardData } from "@/lib/explore";
import { WorkflowCard } from "./workflow-card";

const base: WorkflowCardData = {
  id: "00000000-0000-0000-0000-0000000c0001",
  title: "SaaS landing page from a one-line brief",
  authorHandle: "devjun",
  authorDisplayName: "Jun",
  authorAvatarUrl: null,
  professionName: "Web Developer",
  professionSlug: "web-developer",
  forkCount: 312,
  workedScore: 0.95,
  triedCount: 40,
  publishedAt: null,
  thumb: { kind: "text", url: null },
};

describe("WorkflowCard", () => {
  it("renders content and links the WHOLE card to the detail page", () => {
    render(<WorkflowCard data={base} />);
    // The card link (the savemark overlay is a separate sibling link — Story 8.1); scope by the title.
    const link = screen.getByRole("link", {
      name: /SaaS landing page from a one-line brief/i,
    });
    expect(link).toHaveAttribute("href", `/workflows/${base.id}`);
    expect(
      screen.getByText("SaaS landing page from a one-line brief"),
    ).toBeInTheDocument();
    expect(screen.getByText("@devjun")).toBeInTheDocument();
    expect(screen.getByText("Web Developer")).toBeInTheDocument();
    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText(/95% worked/)).toBeInTheDocument();
  });

  it("hides the worked-% chip when there are no tried votes", () => {
    render(<WorkflowCard data={{ ...base, triedCount: 0, workedScore: 0 }} />);
    expect(screen.queryByText(/worked/)).not.toBeInTheDocument();
    // forks still render
    expect(screen.getByText("312")).toBeInTheDocument();
  });

  it("renders a real image thumbnail when one is available", () => {
    const { container } = render(
      <WorkflowCard
        data={{
          ...base,
          thumb: { kind: "image", url: "https://cdn.example/x.webp" },
        }}
      />,
    );
    expect(
      container.querySelector('img[src="https://cdn.example/x.webp"]'),
    ).not.toBeNull();
  });

  it("omits the author row when there is no handle", () => {
    render(<WorkflowCard data={{ ...base, authorHandle: null }} />);
    expect(screen.queryByText("@devjun")).not.toBeInTheDocument();
    // the title + community chip still render
    expect(screen.getByText("Web Developer")).toBeInTheDocument();
  });

  it("renders the Save bookmark overlay — a sign-in link for anon, a picker button when signed in (Story 8.1)", () => {
    const { rerender } = render(<WorkflowCard data={base} />);
    // Anon: the savemark is a SIBLING link to sign-in (never nested inside the card link).
    expect(
      screen.getByRole("link", { name: /sign in to save/i }),
    ).toBeInTheDocument();
    // Signed in: a button that opens the board picker.
    rerender(<WorkflowCard data={base} signedIn />);
    expect(
      screen.getByRole("button", { name: /save to board/i }),
    ).toBeInTheDocument();
  });
});
