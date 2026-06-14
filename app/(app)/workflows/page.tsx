import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteDraftButton } from "@/components/workflows/delete-draft-button";
import { listMyDrafts } from "@/lib/services/workflows";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "My workflows — idea" };

export default async function WorkflowsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/workflows");

  const drafts = await listMyDrafts();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">
            My workflows
          </h1>
          <p className="mt-1 text-muted-foreground">Your private drafts.</p>
        </div>
        <Link
          href="/workflows/new"
          className={cn(buttonVariants(), "shrink-0")}
        >
          New workflow
        </Link>
      </div>

      {drafts.length === 0 ? (
        <Card className="glass mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">
              No drafts yet. Start a new workflow.
            </p>
            <Link href="/workflows/new" className={cn(buttonVariants())}>
              New workflow
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {drafts.map((d) => (
            <li key={d.id}>
              <Card className="glass">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{d.title}</CardTitle>
                      {d.summary ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {d.summary}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                      Draft
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {d.profession ? (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                        {d.profession.name}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      Updated {new Date(d.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Link
                    href={`/workflows/${d.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
                  >
                    Edit
                  </Link>
                  <DeleteDraftButton id={d.id} title={d.title} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
