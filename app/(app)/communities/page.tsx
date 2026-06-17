import Link from "next/link";
import { professionIcon } from "@/lib/profession-icons";
import { listProfessions } from "@/lib/services/professions";

export const metadata = { title: "Communities — idea" };

/**
 * Communities index (Story 6.2) — replaces the ComingSoon stub. A grid of the professions,
 * each linking to its community landing page (`/communities/{slug}`). Public / SSR.
 */
export default async function CommunitiesPage() {
  const professions = await listProfessions();

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-8">
      <h1 className="font-heading font-bold text-2xl tracking-tight">
        Communities
      </h1>
      <p className="mt-1 text-muted-foreground">
        Each profession is a home for the AI workflows that craft ships. Pick
        yours to browse, fork, and join.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {professions.map((p) => {
          const Icon = professionIcon(p.slug);
          return (
            <Link
              key={p.slug}
              href={`/communities/${p.slug}`}
              className="group flex flex-col gap-3 rounded-card border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c6bff] to-[#6d5ef0] text-white shadow-sm">
                  <Icon width={22} height={22} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <div className="text-muted-foreground text-xs">
                    <span className="font-mono">
                      {p.member_count.toLocaleString("en-US")}
                    </span>{" "}
                    {p.member_count === 1 ? "member" : "members"}
                  </div>
                </div>
              </div>
              {p.description ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {p.description}
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
