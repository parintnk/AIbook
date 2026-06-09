import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        codename: idea
      </p>
      <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
        A cookbook for AI workflows
      </h1>
      <p className="max-w-md text-balance text-lg text-muted-foreground">
        Share, discover, and remix multi-tool AI recipes — organized by
        profession, with a real sample output on every step.
      </p>
      <Button size="lg">Coming soon</Button>
    </main>
  );
}
