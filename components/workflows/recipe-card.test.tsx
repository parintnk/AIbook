import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkflowNode } from "@/lib/services/workflow-nodes";
import { RecipeCard } from "./recipe-card";

const node: WorkflowNode = {
  id: "n1",
  workflow_id: "w1",
  idx: 0,
  pos_x: 0,
  pos_y: 0,
  step_title: "Define brand direction",
  tool_name: "ChatGPT",
  tool_version: "4o",
  prompt: "Warm, artisanal, minimalist palette",
  purpose: "Set the visual direction before generating logos",
  est_time: "~5 min",
  est_cost: "$0.02",
  notes: null,
  note_lang: null,
  tool_url: null,
  created_at: "2026-06-14T00:00:00.000Z",
  updated_at: "2026-06-14T00:00:00.000Z",
};

describe("RecipeCard", () => {
  it("renders the step number, tool chip, and a prompt preview, collapsed by default", () => {
    render(<RecipeCard node={node} mode="viewer" />);
    expect(screen.getByText("1")).toBeInTheDocument(); // idx 0 → step 1
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByText(/Define brand direction/)).toBeInTheDocument();
    expect(screen.getByText(node.prompt)).toBeInTheDocument(); // collapsed preview
    // Details (purpose, etc.) stay hidden until expanded.
    expect(screen.queryByText(node.purpose)).not.toBeInTheDocument();
  });

  it("expands to reveal the full details on click (viewer)", () => {
    render(<RecipeCard node={node} mode="viewer" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(node.purpose)).toBeInTheDocument();
    expect(screen.getByText(node.prompt)).toBeInTheDocument();
  });

  it("renders the sample output content in the expanded card (AC2)", () => {
    render(
      <RecipeCard
        node={node}
        mode="viewer"
        output={
          {
            id: "o1",
            node_id: node.id,
            kind: "text",
            text_content: "the produced result",
            storage_path: null,
            mime: null,
            bytes: null,
            created_at: "2026-06-15T00:00:00.000Z",
            mainUrl: null,
            thumbUrl: null,
          } as React.ComponentProps<typeof RecipeCard>["output"]
        }
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Sample output")).toBeInTheDocument();
    expect(screen.getByText("the produced result")).toBeInTheDocument();
  });

  it("selects on click in editor mode", () => {
    const onSelect = vi.fn();
    render(<RecipeCard node={node} mode="editor" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("opens the editor on double-click (editor)", () => {
    const onEdit = vi.fn();
    render(<RecipeCard node={node} mode="editor" onEdit={onEdit} />);
    fireEvent.doubleClick(screen.getByRole("button"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders an http(s) tool URL as a link when expanded", () => {
    render(
      <RecipeCard
        node={{ ...node, tool_url: "https://chatgpt.com" }}
        mode="viewer"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByRole("link", { name: "https://chatgpt.com" }),
    ).toHaveAttribute("href", "https://chatgpt.com");
  });

  it("does NOT render a javascript: tool URL as a link (stored-XSS guard)", () => {
    render(
      <RecipeCard
        node={{ ...node, tool_url: "javascript:alert(1)" }}
        mode="viewer"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
  });

  it("shows the publish-blocked affordance and routes its click to onEdit (editor)", () => {
    const onEdit = vi.fn();
    render(<RecipeCard node={node} mode="editor" blocked onEdit={onEdit} />);
    const cta = screen.getByText("Add a sample output to publish");
    expect(cta).toBeInTheDocument();
    fireEvent.click(cta);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("does NOT show the authoring affordance in viewer mode even when blocked", () => {
    render(<RecipeCard node={node} mode="viewer" blocked />);
    expect(
      screen.queryByText("Add a sample output to publish"),
    ).not.toBeInTheDocument();
  });

  it("shows neutral 'No sample output yet' when not blocked and outputless", () => {
    render(<RecipeCard node={node} mode="editor" />);
    expect(screen.getByText("No sample output yet")).toBeInTheDocument();
    expect(
      screen.queryByText("Add a sample output to publish"),
    ).not.toBeInTheDocument();
  });

  it("reveals and wires Edit / Delete when selected (editor)", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <RecipeCard
        node={node}
        mode="editor"
        selected
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
