import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll: _scroll,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    scroll?: boolean;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ResultBar } from "./result-bar";

describe("ResultBar", () => {
  it("announces the count via aria-live and links the sorts", () => {
    render(
      <ResultBar
        total={24}
        query="logo kit"
        profession={null}
        tag={null}
        sort="best"
      />,
    );
    expect(screen.getByText(/workflows match this goal/)).toBeInTheDocument();
    expect(
      screen.getByText("24 workflows found, ranked by semantic relevance."),
    ).toBeInTheDocument();

    const best = screen.getByRole("link", { name: /Best match/ });
    expect(best).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: /Most forked/ })).toHaveAttribute(
      "href",
      "/search?q=logo+kit&sort=forked",
    );
  });
});
