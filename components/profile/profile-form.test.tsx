import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The form imports a server action (next/headers chain) and useRouter — mock both.
vi.mock("@/app/settings/profile/actions", () => ({
  updateProfileAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import type { ProfileWithStack } from "@/lib/services/profiles";
import { ProfileForm } from "./profile-form";

const profile: ProfileWithStack = {
  id: "u1",
  handle: "tester",
  display_name: "Tester",
  bio: "",
  avatar_url: null,
  hire_me_url: null,
  hire_me_visible: false,
  primary_profession_id: null,
  created_at: "2026-06-12T00:00:00Z",
  updated_at: "2026-06-12T00:00:00Z",
  ai_stack_items: [],
};

describe("ProfileForm", () => {
  it("renders identity fields seeded from the profile", () => {
    render(<ProfileForm profile={profile} />);
    expect(screen.getByLabelText("Handle")).toHaveValue("tester");
    expect(screen.getByLabelText("Display name")).toHaveValue("Tester");
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save profile/i }),
    ).toBeInTheDocument();
  });

  it("adds an AI Stack row when 'Add tool' is clicked", () => {
    render(<ProfileForm profile={profile} />);
    expect(screen.queryByPlaceholderText("e.g. Midjourney")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /add tool/i }));
    expect(screen.getByPlaceholderText("e.g. Midjourney")).toBeInTheDocument();
  });
});
