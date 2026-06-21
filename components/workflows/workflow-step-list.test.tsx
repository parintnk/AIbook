import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NodeOutputView } from "@/lib/services/node-outputs";
import type { WorkflowEdge } from "@/lib/services/workflow-edges";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { WorkflowStepList } from "./workflow-step-list";

function node(
  over: Partial<WorkflowNode> & Pick<WorkflowNode, "id" | "idx">,
): WorkflowNode {
  return {
    workflow_id: "w1",
    pos_x: 0,
    pos_y: 0,
    step_title: null,
    tool_name: "ChatGPT",
    tool_version: null,
    prompt: "a prompt",
    purpose: "why this step exists",
    est_time: null,
    est_cost: null,
    notes: null,
    note_lang: null,
    tool_url: null,
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:00.000Z",
    ...over,
  };
}

const nodes: WorkflowNode[] = [
  node({
    id: "n1",
    idx: 0,
    step_title: "Define brand direction",
    tool_name: "ChatGPT",
  }),
  node({
    id: "n2",
    idx: 1,
    step_title: "Generate logo",
    tool_name: "Midjourney",
  }),
];

const edges: WorkflowEdge[] = [
  {
    id: "e1",
    workflow_id: "w1",
    source_node_id: "n1",
    target_node_id: "n2",
    created_at: "2026-06-14T00:00:00.000Z",
  },
];

const outputs: Record<string, NodeOutputView> = {
  n1: {
    id: "o1",
    node_id: "n1",
    kind: "text",
    text_content: "Brand direction: warm, artisanal, minimalist.",
    storage_path: null,
    mime: null,
    bytes: null,
    created_at: "2026-06-15T00:00:00.000Z",
    mainUrl: null,
    thumbUrl: null,
  } as NodeOutputView,
};

describe("WorkflowStepList", () => {
  it("renders an ordered list with one item per node, in idx order", () => {
    const { container } = render(
      <WorkflowStepList
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
      />,
    );
    expect(container.querySelector("ol")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // Order: step 1 = ChatGPT, step 2 = Midjourney. The cards no longer carry a number
    // badge (order is the connector arrows); the list's own "Step N of M" label numbers them.
    expect(within(items[0]).getByText("ChatGPT")).toBeInTheDocument();
    expect(within(items[0]).getByText(/step 1 of 2/i)).toBeInTheDocument();
    expect(within(items[1]).getByText("Midjourney")).toBeInTheDocument();
    expect(within(items[1]).getByText(/step 2 of 2/i)).toBeInTheDocument();
  });

  it("announces the edge source→target relationship (AC1)", () => {
    render(
      <WorkflowStepList
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
      />,
    );
    // Step 1 → Step 2: the connection is conveyed as real, SR-readable text.
    expect(screen.getByText(/leads to step 2/i)).toBeInTheDocument();
  });

  it("reveals a step's sample output when its card is expanded (AC1 reading value)", () => {
    render(
      <WorkflowStepList
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
      />,
    );
    const items = screen.getAllByRole("listitem");
    fireEvent.click(within(items[0]).getByRole("button"));
    expect(screen.getByText("Sample output")).toBeInTheDocument();
    expect(
      screen.getByText("Brand direction: warm, artisanal, minimalist."),
    ).toBeInTheDocument();
  });

  it("renders NO editor chrome (read-only viewer)", () => {
    render(
      <WorkflowStepList
        nodes={nodes}
        edges={edges}
        outputsByNodeId={outputs}
      />,
    );
    expect(screen.queryByText(/\+ Add step/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit|delete/i }),
    ).not.toBeInTheDocument();
  });

  it("numbers steps by idx (not array position), so list ↔ card ↔ connector agree even with an idx gap", () => {
    // A published workflow whose draft deleted a middle node then added one → idx [0,2]
    // (the 2.5 gate doesn't enforce contiguity). The step must show idx+1 = 3, matching
    // the RecipeCard + canvas — NOT the array position 2.
    const gapNodes = [
      node({ id: "g1", idx: 0, tool_name: "ChatGPT" }),
      node({ id: "g2", idx: 2, tool_name: "Midjourney" }),
    ];
    const gapEdges: WorkflowEdge[] = [
      {
        id: "ge",
        workflow_id: "w1",
        source_node_id: "g1",
        target_node_id: "g2",
        created_at: "2026-06-14T00:00:00.000Z",
      },
    ];
    render(
      <WorkflowStepList
        nodes={gapNodes}
        edges={gapEdges}
        outputsByNodeId={{}}
      />,
    );
    // The list still numbers by idx+1 in its own descriptors (the card has no number badge now).
    expect(screen.getByText(/leads to step 3/i)).toBeInTheDocument(); // connector → idx+1
    expect(screen.getByText(/step 3 of 2/i)).toBeInTheDocument(); // sr-only → same number
  });

  it("lists multiple outgoing targets in one connector (branch)", () => {
    const brNodes = [
      node({ id: "b1", idx: 0 }),
      node({ id: "b2", idx: 1 }),
      node({ id: "b3", idx: 2 }),
    ];
    const brEdges: WorkflowEdge[] = [
      {
        id: "be1",
        workflow_id: "w1",
        source_node_id: "b1",
        target_node_id: "b2",
        created_at: "2026-06-14T00:00:00.000Z",
      },
      {
        id: "be2",
        workflow_id: "w1",
        source_node_id: "b1",
        target_node_id: "b3",
        created_at: "2026-06-14T00:00:00.000Z",
      },
    ];
    render(
      <WorkflowStepList nodes={brNodes} edges={brEdges} outputsByNodeId={{}} />,
    );
    expect(screen.getByText(/leads to steps 2, 3/i)).toBeInTheDocument();
  });

  it("drops an edge whose target is not in the list (no crash, no 'undefined')", () => {
    const mNodes = [node({ id: "m1", idx: 0 }), node({ id: "m2", idx: 1 })];
    const mEdges: WorkflowEdge[] = [
      {
        id: "me",
        workflow_id: "w1",
        source_node_id: "m1",
        target_node_id: "ghost",
        created_at: "2026-06-14T00:00:00.000Z",
      },
    ];
    render(
      <WorkflowStepList nodes={mNodes} edges={mEdges} outputsByNodeId={{}} />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/leads to step/i)).not.toBeInTheDocument();
  });
});
