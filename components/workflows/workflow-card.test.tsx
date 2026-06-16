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
    const link = screen.getByRole("link");
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
});
