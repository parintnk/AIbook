import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationRow } from "@/lib/notifications";

// ── Mocks: auth (signed-in), router, and the Supabase browser client ──────────
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));

type RealtimeHandler = (payload: { new: NotificationRow }) => void;
let onHandler: RealtimeHandler | null = null;
const removeChannel = vi.fn();
const channelSpy = vi.fn();
const updateEq = vi.fn(() => Promise.resolve({ error: null }));
const updateIs = vi.fn(() => Promise.resolve({ error: null }));
let seed: NotificationRow[] = [];

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const builder = {
      select: () => builder,
      order: () => builder,
      limit: () => Promise.resolve({ data: seed, error: null }),
      update: () => builder,
      eq: updateEq,
      is: updateIs,
    };
    const channel = {
      on: (_event: string, _cfg: unknown, cb: RealtimeHandler) => {
        onHandler = cb;
        return channel;
      },
      subscribe: () => channel,
    };
    return {
      from: () => builder,
      channel: (name: string) => {
        channelSpy(name);
        return channel;
      },
      removeChannel,
    };
  },
}));

import { NotificationsBell } from "./notifications-bell";

function notif(
  over: Partial<NotificationRow> & Pick<NotificationRow, "type">,
): NotificationRow {
  return {
    id: "n1",
    recipient_id: "u1",
    actor_id: "a1",
    target_type: "workflow",
    target_id: "wf1",
    data: {},
    read_at: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

function renderBell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return render(<NotificationsBell />, { wrapper: Wrapper });
}

const openPanel = () =>
  fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "anon-key");
  seed = [];
  onHandler = null;
  push.mockClear();
  removeChannel.mockClear();
  channelSpy.mockClear();
  updateEq.mockClear();
  updateIs.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("NotificationsBell", () => {
  it("renders the bell trigger", () => {
    renderBell();
    expect(
      screen.getByRole("button", { name: /notifications/i }),
    ).toBeInTheDocument();
  });

  it("subscribes to a recipient-scoped realtime channel and cleans up on unmount", () => {
    const { unmount } = renderBell();
    expect(channelSpy).toHaveBeenCalledWith("notifications:u1");
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("opens the panel and lists recent notifications", async () => {
    seed = [
      notif({
        type: "follow",
        target_type: "profile",
        target_id: "a1",
        data: { actor_handle: "ploy", actor_name: "Ploy" },
      }),
    ];
    renderBell();
    openPanel();
    expect(
      await screen.findByText(/started following you/i),
    ).toBeInTheDocument();
    expect(screen.getByText("@ploy")).toBeInTheDocument();
  });

  it("shows the empty state with no notifications", async () => {
    renderBell();
    openPanel();
    expect(
      await screen.findByText(/no notifications yet/i),
    ).toBeInTheDocument();
  });

  it("a live INSERT arrives in the cache and bumps the unread badge", async () => {
    renderBell();
    openPanel();
    // Let the initial (empty) query settle so the INSERT isn't overwritten.
    await screen.findByText(/no notifications yet/i);
    act(() => {
      onHandler?.({
        new: notif({
          id: "live1",
          type: "fork",
          target_id: "wfNew",
          data: { actor_handle: "rae", source_workflow_title: "Live kit" },
        }),
      });
    });
    expect(await screen.findByText(/forked/i)).toBeInTheDocument(); // row landed
    // The unread badge "1" lives inside the bell trigger (tab counts also read "1").
    expect(
      screen.getByRole("button", { name: /notifications/i }),
    ).toHaveTextContent("1");
  });

  it("tapping a row marks it read and routes to its source", async () => {
    seed = [
      notif({
        type: "follow",
        target_type: "profile",
        target_id: "a1",
        data: { actor_handle: "ploy" },
      }),
    ];
    renderBell();
    openPanel();
    fireEvent.click(await screen.findByText(/started following you/i));
    expect(push).toHaveBeenCalledWith("/u/ploy");
    await waitFor(() => expect(updateEq).toHaveBeenCalled()); // mark-read UPDATE …eq("id", …)
  });

  it("mark all read issues a bulk read_at update", async () => {
    seed = [notif({ type: "follow", data: { actor_handle: "ploy" } })];
    renderBell();
    openPanel();
    // Wait for the unread row to load so "Mark all read" is enabled.
    await screen.findByText(/started following you/i);
    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }));
    await waitFor(() => expect(updateIs).toHaveBeenCalled()); // …update({read_at}).is("read_at", null)
  });
});
