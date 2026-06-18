import { describe, expect, it } from "vitest";
import {
  filterByType,
  type NotificationRow,
  notificationHref,
  notificationView,
  typeCounts,
  unreadCount,
} from "./notifications";

/** Minimal row factory — overrides merge over a published default. */
function row(
  over: Partial<NotificationRow> & Pick<NotificationRow, "type">,
): NotificationRow {
  return {
    id: "n1",
    recipient_id: "r1",
    actor_id: "a1",
    target_type: "workflow",
    target_id: "wf1",
    data: {},
    read_at: null,
    created_at: "2026-06-18T00:00:00Z",
    ...over,
  };
}

describe("notificationHref (route-to-source)", () => {
  it("follow → the follower's profile by handle", () => {
    expect(
      notificationHref(
        row({
          type: "follow",
          target_type: "profile",
          target_id: "a1",
          data: { actor_handle: "ploy" },
        }),
      ),
    ).toBe("/u/ploy");
  });

  it("fork/featured/worked/pin → the workflow at target_id", () => {
    expect(notificationHref(row({ type: "fork", target_id: "src-wf" }))).toBe(
      "/workflows/src-wf",
    );
    expect(notificationHref(row({ type: "featured", target_id: "wf9" }))).toBe(
      "/workflows/wf9",
    );
    expect(notificationHref(row({ type: "worked", target_id: "wf9" }))).toBe(
      "/workflows/wf9",
    );
    expect(notificationHref(row({ type: "pin", target_id: "wf9" }))).toBe(
      "/workflows/wf9",
    );
  });

  it("comment/mention → the workflow from data (target_id is the comment)", () => {
    expect(
      notificationHref(
        row({
          type: "comment",
          target_type: "comment",
          target_id: "c1",
          data: { workflow_id: "wfX" },
        }),
      ),
    ).toBe("/workflows/wfX");
    expect(
      notificationHref(
        row({
          type: "mention",
          target_type: "comment",
          target_id: "c1",
          data: { workflow_id: "wfX" },
        }),
      ),
    ).toBe("/workflows/wfX");
  });

  it("degrades to /explore when the routing field is missing", () => {
    expect(notificationHref(row({ type: "follow", data: {} }))).toBe(
      "/explore",
    );
    expect(
      notificationHref(row({ type: "comment", target_id: "", data: {} })),
    ).toBe("/explore");
  });
});

describe("notificationView (per-type descriptor)", () => {
  it("follow: actor label + 'started following you', no target", () => {
    const v = notificationView(
      row({ type: "follow", data: { actor_handle: "max", actor_name: "Max" } }),
    );
    expect(v.actorLabel).toBe("@max");
    expect(v.message).toBe("started following you");
    expect(v.targetLabel).toBeNull();
    expect(v.isSystem).toBe(false);
  });

  it("fork: 'forked' + the source workflow title", () => {
    const v = notificationView(
      row({
        type: "fork",
        data: { actor_handle: "ploy", source_workflow_title: "Coffee kit" },
      }),
    );
    expect(v.message).toBe("forked");
    expect(v.targetLabel).toBe("Coffee kit");
  });

  it("comment: 'commented:' + a snippet", () => {
    const v = notificationView(
      row({
        type: "comment",
        data: {
          actor_handle: "nina",
          comment_snippet: "the vectorize step is gold",
        },
      }),
    );
    expect(v.message).toBe("commented:");
    expect(v.snippet).toBe("the vectorize step is gold");
  });

  it("mention: 'mentioned you'", () => {
    const v = notificationView(
      row({ type: "mention", data: { actor_handle: "arun" } }),
    );
    expect(v.message).toContain("mentioned you");
  });

  it("worked: emerald tone + the workflow title", () => {
    const v = notificationView(
      row({
        type: "worked",
        data: { actor_handle: "sam", workflow_title: "Brand kit" },
      }),
    );
    expect(v.tone).toBe("worked");
    expect(v.targetLabel).toBe("Brand kit");
  });

  it("featured: system row (no actor), Workflow-of-the-Day", () => {
    const v = notificationView(
      row({ type: "featured", data: { workflow_title: "Brand kit" } }),
    );
    expect(v.isSystem).toBe(true);
    expect(v.actorLabel).toBeNull();
    expect(v.targetLabel).toBe("Brand kit");
  });

  it("pin: system row, pinned to the community", () => {
    const v = notificationView(
      row({
        type: "pin",
        data: { workflow_title: "Brand kit", community_name: "AI Automation" },
      }),
    );
    expect(v.isSystem).toBe(true);
    expect(v.targetLabel).toBe("AI Automation");
  });

  it("falls back to the handle-less name, then null", () => {
    expect(
      notificationView(row({ type: "fork", data: { actor_name: "Ploy" } }))
        .actorLabel,
    ).toBe("Ploy");
    expect(
      notificationView(row({ type: "fork", data: {} })).actorLabel,
    ).toBeNull();
  });

  it("carries the unread flag from read_at", () => {
    expect(
      notificationView(row({ type: "follow", read_at: null })).unread,
    ).toBe(true);
    expect(
      notificationView(row({ type: "follow", read_at: "2026-06-18T01:00:00Z" }))
        .unread,
    ).toBe(false);
  });
});

describe("unreadCount", () => {
  it("counts only rows with a null read_at", () => {
    const list = [
      row({ type: "follow", read_at: null }),
      row({ type: "fork", read_at: "2026-06-18T01:00:00Z" }),
      row({ type: "comment", read_at: null }),
    ];
    expect(unreadCount(list)).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
});

describe("typeCounts + filterByType (tabs)", () => {
  const list = [
    row({ type: "mention" }),
    row({ type: "mention" }),
    row({ type: "comment" }),
    row({ type: "fork" }),
  ];

  it("All first with the total, then each present type in mockup order", () => {
    expect(typeCounts(list)).toEqual([
      { tab: "all", count: 4 },
      { tab: "mention", count: 2 },
      { tab: "comment", count: 1 },
      { tab: "fork", count: 1 },
    ]);
  });

  it("omits types absent from the list", () => {
    const tabs = typeCounts(list).map((t) => t.tab);
    expect(tabs).not.toContain("follow");
    expect(tabs).not.toContain("worked");
  });

  it("filterByType('all') is identity; a type filters to that type", () => {
    expect(filterByType(list, "all")).toHaveLength(4);
    expect(filterByType(list, "mention")).toHaveLength(2);
    expect(filterByType(list, "pin")).toHaveLength(0);
  });
});
