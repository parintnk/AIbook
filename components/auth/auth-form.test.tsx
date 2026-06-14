import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// next/navigation and the browser Supabase client aren't available in jsdom —
// mock them so the form renders and its submit handler can run.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
    },
  }),
}));
// OAuthButtons still calls a server action; mock the module so it renders.
vi.mock("@/app/(auth)/actions", () => ({
  oauthSignInAction: vi.fn(),
}));

import { AuthForm } from "./auth-form";
import { OAuthButtons } from "./oauth-buttons";

describe("AuthForm (sign-in)", () => {
  it("renders email + password fields", () => {
    render(<AuthForm mode="sign-in" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("disables submit until the form is valid", async () => {
    render(<AuthForm mode="sign-in" />);
    const submit = screen.getByRole("button", { name: /sign in/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("surfaces an initial server error to assistive tech", () => {
    render(
      <AuthForm
        mode="sign-in"
        initialError="Sign-in failed. Please try again."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in failed");
  });
});

describe("AuthForm (sign-up)", () => {
  it("requires the confirm password to match before submit", async () => {
    render(<AuthForm mode="sign-up" />);
    const submit = screen.getByRole("button", { name: /create account/i });

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "Longenough1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "different" },
    });

    expect(
      await screen.findByText(/passwords don't match/i),
    ).toBeInTheDocument();
    await waitFor(() => expect(submit).toBeDisabled());

    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Longenough1" },
    });
    await waitFor(() => expect(submit).toBeEnabled());
  });
});

describe("OAuthButtons", () => {
  it("renders the Google provider button (Apple removed)", () => {
    render(<OAuthButtons />);
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue with apple/i }),
    ).toBeNull();
  });
});
