"use client";

import { Bell, Home, PlusSquare, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SearchTrigger } from "@/components/nav/search-trigger";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isActivePath } from "@/lib/nav";
import { cn } from "@/lib/utils";

const TAB_CLASS =
  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] outline-none focus-visible:bg-muted/50";

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        TAB_CLASS,
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

/**
 * Mobile bottom tab bar (UX-DR4): Home · Search · Create · Notifications ·
 * Profile. Hidden on desktop (primary nav lives in the top nav there).
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <nav
      aria-label="Primary"
      className="glass fixed inset-x-0 bottom-0 z-40 flex h-16 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <TabLink
        href="/"
        label="Home"
        icon={Home}
        active={isActivePath(pathname, "/", true)}
      />
      <SearchTrigger ariaLabel="Search" className={TAB_CLASS}>
        <Search className="size-5" aria-hidden />
        Search
      </SearchTrigger>
      <TabLink
        href="/workflows/new"
        label="Create"
        icon={PlusSquare}
        active={isActivePath(pathname, "/workflows/new")}
      />
      <button
        type="button"
        className={cn(TAB_CLASS, "text-muted-foreground")}
        aria-label="Notifications"
        onClick={() => setNotifOpen(true)}
      >
        <Bell className="size-5" aria-hidden />
        Alerts
      </button>
      <TabLink
        href="/me"
        label="Profile"
        icon={User}
        active={
          isActivePath(pathname, "/me", true) || pathname.startsWith("/u/")
        }
      />

      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Forks, comments, follows, mentions.
            </SheetDescription>
          </SheetHeader>
          <p className="px-4 pb-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
