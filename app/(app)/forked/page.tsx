import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyForks } from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "My forks — idea" };

/**
 * "My forks" (Story 5.2 / FR15 / UX-DR3). The workflows I've forked — draft AND published — each
 * keeping its "Forked from @x" lineage (a link up to the parent). Auth-gated (my content): a draft
 * fork → Edit, a published fork → View. Replaces the Story 1.6 ComingSoon stub (no new route).
 */
export default async function ForkedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/forked");

  const forks = await listMyForks();

  return (
    <div>
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight">
          My forks
        </h1>
        <p className="mt-1 text-muted-foreground">
          Workflows you&apos;ve forked — pick up where you left off.
        </p>
      </div>

      {forks.length === 0 ? (
        <Card className="glass mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">
              No forks yet — fork a workflow to make it your own.
            </p>
            <Link href="/explore" className={cn(buttonVariants())}>
              Explore workflows
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {forks.map((f) => {
            const isDraft = f.status === "draft";
            const parentHandle = f.parent?.author?.handle ?? null;
            return (
              <li key={f.id}>
                <Card className="glass">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{f.title}</CardTitle>
                        {f.summary ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {f.summary}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 font-medium text-xs",
                          isDraft
                            ? "bg-warning/10 text-warning"
                            : "bg-success/10 text-success",
                        )}
                      >
                        {isDraft ? "Draft" : "Published"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {f.parent && parentHandle ? (
                        <Link
                          href={`/workflows/${f.parent.id}`}
                          className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Forked from @{parentHandle}
                        </Link>
                      ) : null}
                      {f.profession ? (
                        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-secondary-foreground text-xs">
                          {f.profession.name}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground text-xs">
                        Updated {new Date(f.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={
                        isDraft
                          ? `/workflows/${f.id}/edit`
                          : `/workflows/${f.id}`
                      }
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      {isDraft ? "Edit" : "View"}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
