"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Account settings — change email + password via Supabase auth (client-side; no server action
 * needed, the auth SDK holds the session). An email change sends a confirmation to the NEW address
 * before it takes effect. `provider` shows how the user signs in.
 */
export function AccountSettings({
  email,
  provider,
}: {
  email: string;
  provider: string;
}) {
  const [newEmail, setNewEmail] = useState(email);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [emailPending, startEmail] = useTransition();
  const [pwPending, startPw] = useTransition();

  function updateEmail() {
    const next = newEmail.trim();
    if (!next || next === email) return;
    startEmail(async () => {
      const { error } = await createClient().auth.updateUser({ email: next });
      if (error) toast.error(error.message);
      else toast.success(`Confirmation sent to ${next}. Click it to confirm.`);
    });
  }

  function updatePassword() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    startPw(async () => {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) toast.error(error.message);
      else {
        toast.success("Password updated.");
        setPassword("");
        setConfirm("");
      }
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section className="rounded-2xl border border-border p-5">
        <h3 className="font-semibold text-foreground text-sm">Email address</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          You currently sign in with{" "}
          <span className="font-mono">{provider}</span>. Changing your email
          sends a confirmation link to the new address.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
            className="flex-1"
          />
          <Button
            type="button"
            onClick={updateEmail}
            disabled={emailPending || newEmail.trim() === email}
          >
            {emailPending ? "Sending…" : "Update email"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border p-5">
        <h3 className="font-semibold text-foreground text-sm">Password</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          Set a new password (at least 8 characters).
        </p>
        <div className="mt-4 flex max-w-sm flex-col gap-2">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
          <Button
            type="button"
            onClick={updatePassword}
            disabled={pwPending}
            className="self-start"
          >
            {pwPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </section>
    </div>
  );
}
