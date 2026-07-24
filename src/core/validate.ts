import type { AttentionEntry, TimelineNode } from "../types";

const PART = String.raw`-?\d{1,6}(?:-\d{2}(?:-\d{2})?)?(?:T\d{2}(?::\d{2}(?::\d{2})?)?)?`;
export const TL_DATE_RE = new RegExp(`^${PART}(?:\\s*~\\s*${PART})?$`);

// Mirrors PART above, but with capture groups so the numeric year/month/day
// can be pulled out for range checks. Time-of-day is matched but discarded —
// it plays no part in semantic validity here.
const ENDPOINT_RE = /^(-?\d{1,6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T\d{2}(?::\d{2}(?::\d{2})?)?)?$/;

interface DateParts {
  year: number;
  month: number | null;
  day: number | null;
}

function parseEndpoint(part: string): DateParts | null {
  const m = ENDPOINT_RE.exec(part);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: m[2] === undefined ? null : Number(m[2]),
    day: m[3] === undefined ? null : Number(m[3]),
  };
}

function isValidEndpoint(p: DateParts): boolean {
  if (p.month !== null && (p.month < 1 || p.month > 12)) return false;
  if (p.day !== null && (p.day < 1 || p.day > 31)) return false;
  return true;
}

// [year, month??1, day??1] tuple compare — numeric, so negative years (BCE)
// order correctly (-500 < -20).
function endpointTuple(p: DateParts): [number, number, number] {
  return [p.year, p.month ?? 1, p.day ?? 1];
}

function compareTuples(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

// Syntactic validity (TL_DATE_RE) only checks shape. This checks meaning:
// month 1–12, day 1–31 per endpoint, and for `~` ranges, start <= end.
export function isSemanticallyValidDate(date: string): boolean {
  const parts = date.trim().split(/\s*~\s*/);
  const parsed = parts.map(parseEndpoint);
  if (parsed.some((p): p is null => p === null)) return false;
  const endpoints = parsed as DateParts[];
  if (endpoints.some((p) => !isValidEndpoint(p))) return false;
  if (endpoints.length === 2) {
    return compareTuples(endpointTuple(endpoints[0]), endpointTuple(endpoints[1])) <= 0;
  }
  return true;
}

export function partitionNodes(nodes: TimelineNode[]): {
  renderable: TimelineNode[];
  attention: AttentionEntry[];
} {
  const renderable: TimelineNode[] = [];
  const attention: AttentionEntry[] = [];
  for (const n of nodes) {
    if (n.date === null || n.date.trim() === "") attention.push({ node: n, reason: "missing-date" });
    else if (!TL_DATE_RE.test(n.date.trim()) || !isSemanticallyValidDate(n.date.trim())) {
      attention.push({ node: n, reason: "invalid-date" });
    } else renderable.push(n);
  }
  return { renderable, attention };
}
