import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The auth components import server actions (next/headers, supabase/server).
// Mock the module so the client components render in jsdom.
vi.mock("@/app/(auth)/actions", () => ({
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
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

describe("OAuthButtons", () => {
  it("renders Google and Apple provider buttons", () => {
    render(<OAuthButtons />);
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with apple/i }),
    ).toBeInTheDocument();
  });
});
