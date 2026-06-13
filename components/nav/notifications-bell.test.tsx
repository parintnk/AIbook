import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotificationsBell } from "./notifications-bell";

describe("NotificationsBell", () => {
  it("opens the panel without crashing (group/label structure)", async () => {
    render(<NotificationsBell />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    // Regression guard: the label is a base-ui GroupLabel and must be wrapped
    // in a Group, or opening the panel throws.
    expect(
      await screen.findByText(/no notifications yet/i),
    ).toBeInTheDocument();
  });
});
