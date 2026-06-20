import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The form imports a server action (next/headers chain) and useRouter — mock both.
vi.mock("@/app/(app)/settings/profile/actions", () => ({
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
  follower_count: 0,
  following_count: 0,
  notification_prefs: {},
  primary_profession_id: null,
  created_at: "2026-06-12T00:00:00Z",
  updated_at: "2026-06-12T00:00:00Z",
  ai_stack_items: [],
  primary_profession: null,
};

const professions = [
  { id: "p1", name: "Graphic Designer" },
  { id: "p2", name: "Marketer" },
];

describe("ProfileForm", () => {
  it("renders identity fields + the profession picker", () => {
    render(<ProfileForm profile={profile} professions={professions} />);
    expect(screen.getByLabelText("Handle")).toHaveValue("tester");
    expect(screen.getByLabelText("Display name")).toHaveValue("Tester");
    expect(screen.getByLabelText("Bio")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary profession")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Graphic Designer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save profile/i }),
    ).toBeInTheDocument();
  });

  it("adds an AI Stack row when 'Add tool' is clicked", () => {
    render(<ProfileForm profile={profile} professions={professions} />);
    expect(screen.queryByPlaceholderText("e.g. Midjourney")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /add tool/i }));
    expect(screen.getByPlaceholderText("e.g. Midjourney")).toBeInTheDocument();
  });
});
