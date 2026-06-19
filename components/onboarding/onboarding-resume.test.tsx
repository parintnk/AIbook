import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import { OnboardingResume } from "./onboarding-resume";

const KEY = "idea:onboarding";

describe("OnboardingResume (Story 12.2)", () => {
  beforeEach(() => {
    replace.mockReset();
    localStorage.clear();
  });

  it("mirrors the current selection to localStorage on step 2/3", () => {
    render(
      <OnboardingResume profession="graphic-designer" goal="deliver-faster" />,
    );
    expect(localStorage.getItem(KEY)).toBe(
      JSON.stringify({
        profession: "graphic-designer",
        goal: "deliver-faster",
      }),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("restores a saved selection on a cold step 1 + consumes the key", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ profession: "web-developer", goal: "cut-time" }),
    );
    render(<OnboardingResume profession={null} goal={null} />);
    expect(replace).toHaveBeenCalledWith(
      "/welcome?profession=web-developer&goal=cut-time",
    );
    expect(localStorage.getItem(KEY)).toBeNull(); // consumed
  });

  it("does nothing on step 1 with no saved selection", () => {
    render(<OnboardingResume profession={null} goal={null} />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("ignores a corrupt saved value without throwing", () => {
    localStorage.setItem(KEY, "{not json");
    expect(() =>
      render(<OnboardingResume profession={null} goal={null} />),
    ).not.toThrow();
    expect(replace).not.toHaveBeenCalled();
  });
});
