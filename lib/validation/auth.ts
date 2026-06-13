import { z } from "zod";

/**
 * Auth form schemas (DR-5: React Hook Form + Zod). Shared by the client forms
 * (resolver) and the server actions (re-validation — never trust the client).
 */

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Sign-up password policy: length + mixed case + a number. The real breach
 * defense is Supabase Auth's leaked-password protection (HaveIBeenPwned),
 * enabled server-side in the dashboard; this is the baseline composition check
 * mirrored on the client. Max 72 = bcrypt's byte limit (GoTrue truncates past
 * it, so reject rather than silently cut).
 */
export const passwordPolicy = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number");

export const signUpSchema = z
  .object({
    email: z.email("Enter a valid email address"),
    password: passwordPolicy,
    confirmPassword: z.string().min(1, "Re-enter your password to confirm"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

/**
 * Result returned by the email auth actions. On success the action redirects
 * (throws) and never returns; otherwise it returns an error or a
 * verify-your-email signal.
 */
export type AuthFormState = {
  error?: string;
  needsEmailConfirmation?: boolean;
};
