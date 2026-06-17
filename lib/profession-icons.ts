import {
  Code,
  type LucideIcon,
  Megaphone,
  Palette,
  PenLine,
  Sparkles,
  Video,
  Workflow,
} from "lucide-react";

/**
 * The `professions` table has no icon column → map the seeded slugs to a lucide glyph
 * (matches the mockup's per-profession icons). Shared by the Explore profession chips
 * (Story 6.1) and the community landing hero (Story 6.2) so there's one source of truth.
 * An unknown slug falls back to Sparkles.
 */
const PROFESSION_ICONS: Record<string, LucideIcon> = {
  "graphic-designer": Palette,
  "web-developer": Code,
  "video-creator": Video,
  "content-writer": PenLine,
  marketer: Megaphone,
  "ai-automation": Workflow,
};

export function professionIcon(slug: string): LucideIcon {
  return PROFESSION_ICONS[slug] ?? Sparkles;
}
