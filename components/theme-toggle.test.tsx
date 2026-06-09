import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  it("renders an accessible toggle and switches the theme class on <html>", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>,
    );

    const button = await screen.findByRole("button", { name: /theme:/i });
    expect(button).toBeInTheDocument();

    // Cycle order is system → light → dark; from "light" the next is "dark".
    fireEvent.click(button);
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
  });
});
