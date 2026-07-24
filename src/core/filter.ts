import type { Filters, TimelineNode } from "../types";

// Persisted settings are unvalidated `unknown` at the plugin-storage boundary
// and `topicMode` flows into an innerHTML template in filterBar — clamp
// every field to its expected shape/type before it reaches app state.
export function sanitizeFilters(raw: unknown): Filters {
  const r = (raw ?? {}) as Partial<Record<keyof Filters, unknown>>;
  return {
    topics: Array.isArray(r.topics) ? r.topics.filter((t): t is string => typeof t === "string") : [],
    topicMode: r.topicMode === "AND" ? "AND" : "OR",
    types: Array.isArray(r.types) ? r.types.filter((t): t is string => typeof t === "string") : [],
    erasAsBackground: typeof r.erasAsBackground === "boolean" ? r.erasAsBackground : true,
  };
}

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
