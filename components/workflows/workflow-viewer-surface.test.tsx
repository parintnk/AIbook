import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { WorkflowViewerSurface } from "./workflow-viewer-surface";

// Stub the React Flow canvas — it needs ResizeObserver (absent in jsdom). This test
// isolates the surface's toggle/breakpoint logic, not the canvas internals.
vi.mock("./workflow-canvas-viewer", () => ({
  WorkflowCanvasViewer: () => <div data-testid="canvas-stub">canvas</div>,
}));

const nodes: WorkflowNode[] = [
  {
    id: "n1",
    workflow_id: "w1",
    idx: 0,
    pos_x: 0,
    pos_y: 0,
    step_title: "Define brand direction",
    tool_name: "ChatGPT",
    tool_version: null,
    prompt: "a prompt",
    purpose: "why",
    est_time: null,
    est_cost: null,
    notes: null,
    note_lang: null,
    tool_url: null,
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:00.000Z",
  },
];
const edges: WorkflowEdge[] = [];
const outputs: Record<string, NodeOutputView> = {};

function setMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => setMatchMedia(false));

function renderSurface() {
  return render(
    <WorkflowViewerSurface
      nodes={nodes}
      edges={edges}
      outputsByNodeId={outputs}
    />,
  );
}

describe("WorkflowViewerSurface", () => {
  it("defaults to the list view on a small screen (SSR-safe primary path)", () => {
    setMatchMedia(false);
    renderSurface();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-stub")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view as list/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /view as canvas/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to the canvas when the Canvas toggle is clicked", async () => {
    setMatchMedia(false);
    renderSurface();
    fireEvent.click(screen.getByRole("button", { name: /view as canvas/i }));
    expect(await screen.findByTestId("canvas-stub")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view as canvas/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("promotes to the canvas on ≥md after mount, and toggles back to the list", async () => {
    setMatchMedia(true);
    renderSurface();
    expect(await screen.findByTestId("canvas-stub")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /view as list/i }));
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-stub")).not.toBeInTheDocument();
  });
});
