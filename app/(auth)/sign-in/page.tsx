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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const params = await searchParams;
  const next = sanitizeNext(params.next);
  const initialError = params.error
    ? "Sign-in failed. Please try again."
    : undefined;

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <Card className="glass w-full max-w-md rounded-card">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to create and engage with workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <OAuthButtons next={params.next} />
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
    </main>
  );
}
