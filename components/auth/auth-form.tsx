"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { signInWithEmail, signUpWithEmail } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type SignInValues,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

type Mode = "sign-in" | "sign-up";

/**
 * Email + password form (RHF + Zod). Client-side validation gates submission;
 * the server action re-validates and establishes the session. On success the
 * action redirects; errors render inline (aria-live) for assistive tech.
 */
export function AuthForm({
  mode,
  next,
  initialError,
}: {
  mode: Mode;
  next?: string;
  initialError?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(
    initialError ?? null,
  );
  const [emailSent, setEmailSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SignInValues>({
    resolver: standardSchemaResolver(
      mode === "sign-in" ? signInSchema : signUpSchema,
    ),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: SignInValues) {
    setServerError(null);
    startTransition(async () => {
      const result =
        mode === "sign-in"
          ? await signInWithEmail(values, next)
          : await signUpWithEmail(values, next);
      if (result?.error) setServerError(result.error);
      if (result?.needsEmailConfirmation) setEmailSent(true);
    });
  }

  if (emailSent) {
    // Reached for both a genuine new sign-up and an already-registered email
    // (Supabase returns no session + no error for both), so always offer a way
    // back to sign-in.
    return (
      <output className="block text-sm text-muted-foreground">
        Almost there — check your inbox to confirm your email. Already have an
        account?{" "}
        <Link
          href="/sign-in"
          className="text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
        .
      </output>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {errors.email ? (
          <p
            id="email-error"
            className="text-sm text-destructive"
            aria-live="polite"
          >
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...register("password")}
        />
        {errors.password ? (
          <p
            id="password-error"
            className="text-sm text-destructive"
            aria-live="polite"
          >
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-11"
        disabled={!isValid || isPending}
      >
        {isPending
          ? "Please wait…"
          : mode === "sign-in"
            ? "Sign in"
            : "Create account"}
      </Button>
    </form>
  );
}
