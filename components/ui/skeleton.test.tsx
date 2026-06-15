import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder that honors reduced-motion and merges className", () => {
    render(<Skeleton className="h-8 w-40" data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el).toHaveClass("animate-pulse");
    expect(el).toHaveClass("motion-reduce:animate-none");
    expect(el).toHaveClass("h-8", "w-40");
    // Decorative — kept out of the a11y tree (the loading container owns the status).
    expect(el).toHaveAttribute("aria-hidden", "true");
  });
});
