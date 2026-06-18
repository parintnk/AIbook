"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Inbox, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { NotificationRow } from "@/components/nav/notification-row";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  filterByType,
  type NotificationTab,
  notificationHref,
  type NotificationRow as Row,
  typeCounts,
  unreadCount,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import styles from "./notifications-bell.module.css";

const LIMIT = 20;
const FLASH_MS = 1200;

/**
 * Notifications bell (Story 9.3). Realtime panel of recent events (FR20 / UX-DR20 / AR12):
 * - initial recent list via TanStack Query (browser client, RLS-scoped to me, newest-first)
 * - live arrivals via a Supabase Realtime channel scoped to my recipient_id → prepended to the
 *   Query cache + flashed; the bell shows an unread count
 * - per-type filter tabs (client-side over the cached list)
 * - tapping a row marks it read (optimistic) + routes to its source
 * The full grouped-digest page is deferred (footer links to notification settings only).
 */
export function NotificationsBell() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Pending `.justnew` flash timers — cleared on unmount so they never setState late.
  const flashTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // One browser client for the component; null when Supabase env is absent
  // (keeps the app bootable + the bell inert rather than throwing).
  const supabase = useMemo(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return null;
    }
    return createClient();
  }, []);

  const queryKey = useMemo(() => ["notifications", userId] as const, [userId]);

  const { data: list = [], isLoading } = useQuery({
    queryKey,
    enabled: !!userId && !!supabase,
    queryFn: async () => {
      if (!supabase) return [] as Row[];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Realtime: prepend live INSERTs to the cache + flash them (RLS gates the channel to me).
  useEffect(() => {
    if (!userId || !supabase) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Row;
          queryClient.setQueryData<Row[]>(queryKey, (old = []) =>
            old.some((n) => n.id === incoming.id)
              ? old
              : [incoming, ...old].slice(0, LIMIT),
          );
          setFlashIds((prev) => new Set(prev).add(incoming.id));
          const timer = setTimeout(() => {
            flashTimers.current.delete(timer);
            setFlashIds((prev) => {
              const next = new Set(prev);
              next.delete(incoming.id);
              return next;
            });
          }, FLASH_MS);
          flashTimers.current.add(timer);
        },
      )
      .subscribe();
    const timers = flashTimers.current;
    return () => {
      void supabase.removeChannel(channel);
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, [userId, supabase, queryClient, queryKey]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<Row[]>(queryKey);
      const now = new Date().toISOString();
      queryClient.setQueryData<Row[]>(queryKey, (old = []) =>
        old.map((n) =>
          n.id === id && !n.read_at ? { ...n, read_at: now } : n,
        ),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
    // Reconcile with the server after the optimistic write settles — heals any
    // divergence (a realtime INSERT that arrived mid-flight, or a cross-tab read).
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      if (!supabase) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<Row[]>(queryKey);
      const now = new Date().toISOString();
      queryClient.setQueryData<Row[]>(queryKey, (old = []) =>
        old.map((n) => (n.read_at ? n : { ...n, read_at: now })),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const unread = unreadCount(list);
  const tabs = useMemo(() => typeCounts(list), [list]);
  const visible = useMemo(() => filterByType(list, tab), [list, tab]);

  const onSelect = useCallback(
    (row: Row) => {
      if (!row.read_at) markRead.mutate(row.id);
      setOpen(false);
      router.push(notificationHref(row));
    },
    [markRead, router],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        className={styles.bell}
      >
        {unread > 0 ? (
          <span className={cn(styles.badgeNum, styles.mono)}>
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
        <Bell size={19} aria-hidden />
      </PopoverTrigger>

      <PopoverContent className={styles.panel}>
        <span className={styles.notch} aria-hidden />

        <div className={styles.head}>
          <h3>Notifications</h3>
          <span className={styles.live}>
            <span className={styles.ld} aria-hidden />
            Live
          </span>
          <button
            type="button"
            className={styles.markall}
            onClick={() => markAll.mutate()}
            disabled={unread === 0}
          >
            Mark all read
          </button>
        </div>

        <div className={styles.tabs}>
          {tabs.map(({ tab: t, count }) => (
            <button
              key={t}
              type="button"
              className={cn(styles.tab, t === tab && styles.tabOn)}
              onClick={() => setTab(t)}
            >
              {t === "all" ? "All" : t}
              <span className={cn(styles.ct, styles.mono)}>{count}</span>
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {isLoading ? (
            <NotificationSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState filtered={tab !== "all" && list.length > 0} />
          ) : (
            visible.map((row) => (
              <NotificationRow
                key={row.id}
                row={row}
                isNew={flashIds.has(row.id)}
                onSelect={onSelect}
              />
            ))
          )}
        </div>

        <div className={styles.foot}>
          <Link
            href="/settings/notifications"
            className={styles.settings}
            onClick={() => setOpen(false)}
          >
            <Settings size={12} aria-hidden /> Notification settings
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className={styles.empty}>
      <Inbox size={26} className={styles.emptyIcon} aria-hidden />
      <span className={styles.emptyTitle}>
        {filtered ? "Nothing here" : "No notifications yet"}
      </span>
      <span className={styles.emptySub}>
        {filtered
          ? "No notifications of this type."
          : "Forks, comments, follows and mentions will show up here."}
      </span>
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={styles.skelRow}>
          <Skeleton className="size-[38px] rounded-full" />
          <div className={styles.skelText}>
            <Skeleton className="h-3 w-[78%]" />
            <Skeleton className="h-2.5 w-[40%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
