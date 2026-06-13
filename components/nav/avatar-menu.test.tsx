import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const authState = vi.fn();
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => authState(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

import { AvatarMenu } from "./avatar-menu";

describe("AvatarMenu", () => {
  it("shows a Sign in link when signed out", () => {
    authState.mockReturnValue({ user: null, loading: false });
    render(<AvatarMenu />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /account menu/i })).toBeNull();
  });

  it("shows the account-menu trigger when signed in", () => {
    authState.mockReturnValue({
      user: { email: "x@y.com", user_metadata: {} },
      loading: false,
    });
    render(<AvatarMenu />);
    expect(
      screen.getByRole("button", { name: /account menu/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
  });
});
