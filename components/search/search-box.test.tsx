import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SearchBox } from "./search-box";

function submitWith(value: string) {
  const input = screen.getByLabelText("Search workflows by goal");
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

describe("SearchBox", () => {
  it("navigates to /search on submit with a trimmed query", () => {
    push.mockClear();
    render(<SearchBox />);
    submitWith("  logo kit");
    expect(push).toHaveBeenCalledWith("/search?q=logo+kit");
  });

  it("does not navigate on a blank query", () => {
    push.mockClear();
    render(<SearchBox />);
    submitWith("   ");
    expect(push).not.toHaveBeenCalled();
  });
});
