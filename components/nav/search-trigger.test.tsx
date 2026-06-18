import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SearchTrigger } from "./search-trigger";

describe("SearchTrigger", () => {
  it("opens the launcher and routes to /search when a suggested goal is picked", async () => {
    push.mockClear();
    render(<SearchTrigger>Search</SearchTrigger>);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "weekly content calendar" }),
    );
    expect(push).toHaveBeenCalledWith("/search?q=weekly+content+calendar");
  });

  it("routes to /search on typing a goal and submitting", async () => {
    push.mockClear();
    render(<SearchTrigger>Search</SearchTrigger>);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const input = await screen.findByLabelText("Search workflows by goal");
    fireEvent.change(input, { target: { value: "brand kit" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(push).toHaveBeenCalledWith("/search?q=brand+kit");
  });
});
