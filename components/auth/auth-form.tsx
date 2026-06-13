"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { signInWithEmail, signUpWithEmail } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  type SignUpValues,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

type Mode = "sign-in" | "sign-up";

const LEAD_ICON =
  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground";
const REVEAL_BTN =
  "absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";

/** 0–4 strength score + label from length + character variety. */
function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++;
  return { score, label: ["", "Weak", "Fair", "Good", "Strong"][score] ?? "" };
}

/**
 * Email + password form (RHF + Zod). Client-side validation gates submission;
 * the server action re-validates and establishes the session. Sign-up adds a
 * confirm-password field (schema refine) + a strength hint. On success the
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isSignUp = mode === "sign-up";
  // Cloudflare Turnstile (bot protection). When the site key is set, the widget
  // renders and a token is required before submit; Supabase verifies it
  // server-side once CAPTCHA is enabled in the dashboard.
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<SignUpValues>({
    resolver: standardSchemaResolver(
      isSignUp ? signUpSchema : signInSchema,
    ) as unknown as Resolver<SignUpValues>,
    mode: "onChange",
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  function onSubmit(values: SignUpValues) {
    setServerError(null);
    startTransition(async () => {
      const token = captchaToken ?? undefined;
      const result = isSignUp
        ? await signUpWithEmail(values, next, token)
        : await signInWithEmail(values, next, token);
      if (result?.error) {
        setServerError(result.error);
        // The captcha token is single-use — reset the widget for a retry.
        turnstileRef.current?.reset();
        setCaptchaToken(null);
      }
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

  const password = watch("password");
  const strength = isSignUp ? passwordStrength(password) : null;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className={LEAD_ICON} aria-hidden />
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="pl-10"
            {...register("email")}
          />
        </div>
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
        <div className="relative">
          <Lock className={LEAD_ICON} aria-hidden />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="px-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className={REVEAL_BTN}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {isSignUp && strength && password ? (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < strength.score ? "bg-primary" : "bg-border",
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {strength.label}
            </span>
          </div>
        ) : null}
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

      {isSignUp ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Lock className={LEAD_ICON} aria-hidden />
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? true : undefined}
              aria-describedby={
                errors.confirmPassword ? "confirm-error" : undefined
              }
              className="px-10"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((s) => !s)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              aria-pressed={showConfirm}
              className={REVEAL_BTN}
            >
              {showConfirm ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
          {errors.confirmPassword ? (
            <p
              id="confirm-error"
              className="text-sm text-destructive"
              aria-live="polite"
            >
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {serverError ? (
        <p
          className="text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </p>
      ) : null}

      {captchaSiteKey ? (
        <Turnstile
          ref={turnstileRef}
          siteKey={captchaSiteKey}
          onSuccess={setCaptchaToken}
          onError={() => setCaptchaToken(null)}
          onExpire={() => setCaptchaToken(null)}
          options={{ size: "flexible", theme: "auto" }}
        />
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-11 bg-gradient-to-br from-[#7c6bff] to-primary shadow-lg shadow-primary/30 hover:brightness-105"
        disabled={!isValid || isPending || (!!captchaSiteKey && !captchaToken)}
      >
        {isPending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
