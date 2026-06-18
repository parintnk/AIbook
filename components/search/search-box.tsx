"use client";

import { Search, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { buildSearchHref } from "@/lib/search";
import styles from "./search.module.css";

/**
 * The active search header (mockup `.bodysearch`) — the editable goal query on the `/search` page.
 * Submitting (Enter) navigates to `/search?q=…` (RSC re-renders with results); the URL stays the
 * source of truth (DR-5). Reused as the page's only query input; the nav `search-trigger` launches it.
 */
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    if (q) router.push(buildSearchHref({ q }));
  }

  return (
    <search>
      <form className={styles.bodysearch} onSubmit={onSubmit}>
        <span className={styles.si}>
          <Search width={19} height={19} aria-hidden="true" />
        </span>
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search workflows by goal…"
          aria-label="Search workflows by goal"
          enterKeyHint="search"
        />
        <span className={styles.modepill}>
          <Sparkles width={12} height={12} aria-hidden="true" />
          By goal
        </span>
        {value ? (
          <button
            type="button"
            className={styles.clr}
            aria-label="Clear search"
            onClick={() => setValue("")}
          >
            <X width={14} height={14} aria-hidden="true" />
          </button>
        ) : null}
      </form>
    </search>
  );
}
