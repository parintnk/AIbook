import { describe, expect, it } from "vitest";
import { topologicalOrder } from "./workflow-nodes";

const n = (...ids: string[]) => ids.map((id, idx) => ({ id, idx }));
const e = (...pairs: [string, string][]) =>
  pairs.map(([source_node_id, target_node_id]) => ({
    source_node_id,
    target_node_id,
  }));

describe("topologicalOrder", () => {
  it("orders a linear chain by its edges, not by idx", () => {
    // idx order is a,b,c,d but the chain is a→c→b→d.
    const order = topologicalOrder(
      n("a", "b", "c", "d"),
      e(["a", "c"], ["c", "b"], ["b", "d"]),
    );
    expect(order).toEqual(["a", "c", "b", "d"]);
  });

  it("puts a spliced node in its chain position (the reported bug)", () => {
    // Chain a→b→c→d, splice x between a and b → a→x, x→b, b→c, c→d.
    // x has idx 4 (appended last) but must come out 2nd.
    const order = topologicalOrder(
      [...n("a", "b", "c", "d"), { id: "x", idx: 4 }],
      e(["a", "x"], ["x", "b"], ["b", "c"], ["c", "d"]),
    );
    expect(order).toEqual(["a", "x", "b", "c", "d"]);
  });

  it("appends disconnected nodes by idx after the chain", () => {
    const order = topologicalOrder(n("a", "b", "lonely"), e(["a", "b"]));
    expect(order).toEqual(["a", "b", "lonely"]);
  });
});
