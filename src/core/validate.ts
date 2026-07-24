import type { AttentionEntry, TimelineNode } from "../types";

const PART = String.raw`-?\d{1,6}(?:-\d{2}(?:-\d{2})?)?(?:T\d{2}(?::\d{2}(?::\d{2})?)?)?`;
export const TL_DATE_RE = new RegExp(`^${PART}(?:\\s*~\\s*${PART})?$`);

export function partitionNodes(nodes: TimelineNode[]): {
  renderable: TimelineNode[];
  attention: AttentionEntry[];
} {
  const renderable: TimelineNode[] = [];
  const attention: AttentionEntry[] = [];
  for (const n of nodes) {
    if (n.date === null || n.date.trim() === "") attention.push({ node: n, reason: "missing-date" });
    else if (!TL_DATE_RE.test(n.date.trim())) attention.push({ node: n, reason: "invalid-date" });
    else renderable.push(n);
  }
  return { renderable, attention };
}
