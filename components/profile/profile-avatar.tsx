"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function initials(name: string | null, handle: string): string {
  const src = (name ?? handle).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return chars.toUpperCase() || "?";
}

/**
 * Circular avatar: the user's image when present, otherwise a gradient initials
 * tile (DESIGN.md). Falls back to the initials tile if the image fails to load
 * (avatar_url is free-text user input, so a broken/non-image URL is possible).
 * Plain <img> — arbitrary provider/storage hosts avoid next/image remote config.
 */
export function ProfileAvatar({
  avatarUrl,
  displayName,
  handle,
  className,
}: {
  avatarUrl: string | null;
  displayName: string | null;
  handle: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (avatarUrl && !errored) {
    return (
      <img
        src={avatarUrl}
        alt={displayName ?? handle}
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-5 font-heading font-semibold text-primary-foreground",
        className,
      )}
    >
      {initials(displayName, handle)}
    </div>
  );
}
