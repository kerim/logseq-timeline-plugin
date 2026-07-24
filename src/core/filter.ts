import type { Filters, TimelineNode } from "../types";

export function applyFilters(nodes: TimelineNode[], f: Filters): TimelineNode[] {
  return nodes.filter((n) => matchesTopics(n, f) && matchesTypes(n, f));
}

function matchesTopics(n: TimelineNode, f: Filters): boolean {
  if (f.topics.length === 0) return true;
  const titles = new Set(n.topics.map((t) => t.title));
  return f.topicMode === "AND"
    ? f.topics.every((t) => titles.has(t))
    : f.topics.some((t) => titles.has(t));
}

function matchesTypes(n: TimelineNode, f: Filters): boolean {
  if (f.types.length === 0) return true;
  return n.type !== null && f.types.includes(n.type);
}
