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
  it("renders the step number and tool chip, collapsed by default", () => {
    render(<RecipeCard node={node} mode="viewer" />);
    expect(screen.getByText("1")).toBeInTheDocument(); // idx 0 → step 1
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByText(/Define brand direction/)).toBeInTheDocument();
    expect(screen.queryByText(node.prompt)).not.toBeInTheDocument();
  });

  it("expands to reveal the prompt on click (viewer)", () => {
    render(<RecipeCard node={node} mode="viewer" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(node.prompt)).toBeInTheDocument();
    expect(screen.getByText(node.purpose)).toBeInTheDocument();
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
