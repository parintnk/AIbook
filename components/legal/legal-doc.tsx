import type { ReactNode } from "react";

/** Shared chrome for the static legal pages (Privacy / Terms) — title, last-updated, prose styling. */
export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-heading font-bold text-3xl tracking-tight">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Last updated {updated}
      </p>
      <div className="mt-8 flex flex-col gap-5 text-[15px] text-foreground/90 leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mt-3 [&_h2]:font-heading [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:text-lg [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
