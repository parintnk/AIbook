import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RateLimitNotice } from "./rate-limit-notice";

describe("RateLimitNotice (UX-DR21)", () => {
  it("renders the reset copy as a polite status, not an error", () => {
    render(<RateLimitNotice feature="skeleton" limit={5} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "You've used today's 5 skeleton runs. Resets at midnight.",
    );
    expect(status).toHaveAttribute("aria-live", "polite");
    // not a hard error → no alert role
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("labels the Doctor feature", () => {
    render(<RateLimitNotice feature="doctor" limit={10} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You've used today's 10 Doctor runs. Resets at midnight.",
    );
  });
});
