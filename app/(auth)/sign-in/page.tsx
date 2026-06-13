import { LogIn } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sanitizeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sign in — idea" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(params.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  const initialError = params.error
    ? "Sign-in failed. Please try again."
    : undefined;

  return (
    <Card className="glass w-full rounded-card shadow-lg shadow-primary/20 ring-1 ring-primary/30">
      <CardHeader className="flex flex-col items-start gap-1.5">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-accent px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-accent-foreground">
          <LogIn className="size-3" aria-hidden="true" />
          Sign in
        </span>
        <CardTitle className="font-heading text-xl font-extrabold tracking-tight">
          Welcome back
        </CardTitle>
        <CardDescription>Pick up right where you left off.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <OAuthButtons next={next} />
        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <AuthForm mode="sign-in" next={next} initialError={initialError} />
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/sign-up"
            className="text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
