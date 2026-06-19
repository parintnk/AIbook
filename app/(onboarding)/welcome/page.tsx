import type { ReactNode } from "react";
import { GoalStep } from "@/components/onboarding/goal-step";
import { OnboardingHeader } from "@/components/onboarding/onboarding-header";
import { PreviewStep } from "@/components/onboarding/preview-step";
import { ProfessionStep } from "@/components/onboarding/profession-step";
import { goalBySlug } from "@/lib/onboarding";
import { listProfessions } from "@/lib/services/professions";
import { listPublishedWorkflows } from "@/lib/services/workflows";

export const metadata = { title: "Get started — idea" };

/**
 * Choose-your-path onboarding (Story 12.1 / FR1, UX-DR24). A PRE-AUTH, 3-step flow — pick profession →
 * pick goal → preview 3 real workflows — that previews value before any sign-up wall. URL-driven (DR-5):
 * `/welcome` = step 1, `?profession={slug}` = step 2, `?profession&goal` = step 3. Slugs are validated
 * (unknown → drop → the earlier step, the 6.1 lesson). The preview reuses `listPublishedWorkflows`
 * (most-forked, anon-safe). Anon reach here because `/` redirects them (the authed `/` is unchanged).
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ profession?: string; goal?: string }>;
}) {
  const sp = await searchParams;
  const professions = await listProfessions();

  // Validate the profession slug → drop unknown (the 6.1/6.2 validate-or-fallback lesson).
  const profession = sp.profession
    ? (professions.find((p) => p.slug === sp.profession) ?? null)
    : null;
  // Goal is only meaningful once a profession is chosen; unknown → drop → step 2.
  const goal = profession ? goalBySlug(sp.goal) : null;

  const step: 1 | 2 | 3 = !profession ? 1 : !goal ? 2 : 3;

  let panel: ReactNode;
  if (!profession) {
    panel = (
      <ProfessionStep
        professions={professions.map((p) => ({ slug: p.slug, name: p.name }))}
      />
    );
  } else if (!goal) {
    panel = (
      <GoalStep
        professionSlug={profession.slug}
        professionName={profession.name}
      />
    );
  } else {
    const { items } = await listPublishedWorkflows({
      profession: profession.slug,
      sort: "trending",
      limit: 3,
    });
    panel = (
      <PreviewStep
        professionName={profession.name}
        goalTitle={goal.title}
        workflows={items}
        signupNext={`/explore?profession=${profession.slug}`}
      />
    );
  }

  return (
    <>
      <OnboardingHeader step={step} professionSlug={profession?.slug ?? null} />
      {panel}
    </>
  );
}
