"use client";

import { Sparkles } from "lucide-react";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import type { SearchResultCard as Card } from "@/lib/search";
import styles from "./search.module.css";

/**
 * A search result = the shared Explore `WorkflowCard` (app-wide consistency + the saved-state +
 * thumbnail pipeline) with the relevance-% affordance as a sibling overlay (top-LEFT so it never
 * collides with the card's top-right Save bookmark — the 8.1 sibling-overlay rule). Keyword-fallback
 * rows (no similarity score) render via `KeywordFallback`, not this card.
 */
export function SearchResultCard({
  data,
  signedIn = false,
}: {
  data: Card;
  signedIn?: boolean;
}) {
  return (
    <div className={styles.cardWrap}>
      {data.matchPct != null ? (
        <span className={styles.relevance}>
          <Sparkles aria-hidden="true" />
          {data.matchPct}% match
        </span>
      ) : null}
      <WorkflowCard data={data} signedIn={signedIn} />
    </div>
  );
}
