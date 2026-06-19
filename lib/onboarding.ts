import {
  Clock,
  GraduationCap,
  type LucideIcon,
  Search,
  Zap,
} from "lucide-react";

/**
 * Onboarding goals (Story 12.1 / FR1, step 2). There is NO goals table — these are a fixed,
 * profession-agnostic set (the onboarding mockup's 4 universal goals). Client-safe (no `server-only`)
 * so both the RSC flow and tests can import. The chosen goal personalizes the preview COPY and is
 * captured for the account (Story 12.2); it does NOT filter the workflow query in v1 (no goal→workflow
 * data — honest labeling, the 6.1 lesson).
 */
export type OnboardingGoal = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const ONBOARDING_GOALS: OnboardingGoal[] = [
  {
    slug: "deliver-faster",
    title: "Deliver client work faster",
    description: "Ship the same quality in a fraction of the hours.",
    icon: Zap,
  },
  {
    slug: "find-clients",
    title: "Find new clients",
    description: "Build pitches, portfolios, and outreach that land.",
    icon: Search,
  },
  {
    slug: "cut-time",
    title: "Cut work time in half",
    description: "Replace the repetitive parts with proven recipes.",
    icon: Clock,
  },
  {
    slug: "learn-skill",
    title: "Learn a new skill",
    description: "See how others combine AI tools, step by step.",
    icon: GraduationCap,
  },
];

/** Resolve a goal slug → the goal, or null (an unknown/absent slug → step 2 falls back). */
export function goalBySlug(
  slug: string | null | undefined,
): OnboardingGoal | null {
  if (!slug) return null;
  return ONBOARDING_GOALS.find((g) => g.slug === slug) ?? null;
}
