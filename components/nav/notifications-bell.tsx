"use client";

import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Notifications bell — opens a placeholder panel. The realtime list arrives in
 * Epic 9 (FR20). base-ui's Menu handles Esc + focus + outside-click.
 */
export function NotificationsBell() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Notifications"
        className="flex size-10 items-center justify-center rounded-xl border border-input bg-card text-muted-foreground shadow-sm outline-none transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bell className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        </DropdownMenuGroup>
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
          No notifications yet.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
