import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CanvasFrameSkeleton,
  TrustRowSkeleton,
  ViewerSurfaceSkeleton,
  WorkflowHeaderSkeleton,
} from "./viewer-skeleton";

const skeletons = (c: HTMLElement) =>
  c.querySelectorAll('[data-slot="skeleton"]');

describe("viewer skeletons", () => {
  it("WorkflowHeaderSkeleton renders pill / title / summary / avatar placeholder blocks", () => {
    const { container } = render(<WorkflowHeaderSkeleton />);
    expect(skeletons(container).length).toBeGreaterThanOrEqual(4);
  });

  it("TrustRowSkeleton renders ~4 pill placeholders at the trust-row offset", () => {
    const { container } = render(<TrustRowSkeleton />);
    expect(skeletons(container).length).toBeGreaterThanOrEqual(3);
  });

  it("CanvasFrameSkeleton renders a 70vh frame (matches the canvas container, no CLS)", () => {
    const { container } = render(<CanvasFrameSkeleton />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toMatch(/h-\[70vh\]/);
  });

  it("ViewerSurfaceSkeleton renders the toggle row + step-card blocks (mirrors the list first paint)", () => {
    const { container } = render(<ViewerSurfaceSkeleton />);
    // Toggle pills (2) + step cards (3) = 5 skeleton blocks; not the 70vh canvas frame.
    expect(skeletons(container).length).toBeGreaterThanOrEqual(5);
    expect(container.querySelector(".h-\\[70vh\\]")).toBeNull();
  });
});
