import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="glass flex max-w-xl flex-col items-center gap-6 rounded-card px-8 py-12">
        <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
          codename: idea
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          A cookbook for AI workflows
        </h1>
        <p className="max-w-md text-balance text-lg text-muted-foreground">
          Share, discover, and remix multi-tool AI recipes — organized by
          profession, with a real sample output on every step.
        </p>
        <Button size="lg">Coming soon</Button>
      </div>
    </main>
  );
}
