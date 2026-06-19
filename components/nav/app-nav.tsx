"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AvatarMenu } from "@/components/nav/avatar-menu";
import { NotificationsBell } from "@/components/nav/notifications-bell";
import { SearchTrigger } from "@/components/nav/search-trigger";
import { isActivePath, PRIMARY_NAV_LINKS } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Glass sticky top nav (the persistent spine). Desktop: brand · primary links
 * (active = violet-tint pill) · inline search · bell · avatar menu. Mobile:
 * brand + search icon + avatar (primary nav moves to the bottom tab bar).
 * [Source: DESIGN.md "Glass top nav"; explore-light.html]
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-16 border-border border-b bg-background/90 backdrop-blur-xl backdrop-saturate-150">
      <nav className="flex h-full items-center gap-[18px] px-6">
        <BrandLogo />

        <ul className="hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV_LINKS.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-[10px] px-[13px] py-2 text-sm transition-colors",
                    active
                      ? "bg-accent font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(109,94,240,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(139,124,255,0.35)]"
                      : "font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* desktop inline search — ≤340px, right-aligned [Source: explore-light .search] */}
        <SearchTrigger className="ml-auto hidden w-[clamp(180px,28vw,340px)] items-center gap-[9px] rounded-full border border-input bg-card px-[17px] py-2.5 text-left text-[13.5px] text-muted-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-foreground/10 lg:flex">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Search workflows, tools, people…</span>
        </SearchTrigger>

        {/* mobile search icon */}
        <SearchTrigger
          ariaLabel="Search"
          className="ml-auto flex size-11 items-center justify-center rounded-xl border border-input bg-card text-muted-foreground lg:ml-0 lg:hidden"
        >
          <Search className="size-5" aria-hidden />
        </SearchTrigger>

        <NotificationsBell />
        <AvatarMenu />
      </nav>
    </header>
  );
}
