import { z } from "zod";

/**
 * Auth form schemas (DR-5: React Hook Form + Zod). Shared by the client forms
 * (resolver) and the server actions (re-validation — never trust the client).
 */

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
