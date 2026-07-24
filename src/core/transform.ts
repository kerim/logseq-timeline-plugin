import type { TimelineNode } from "../types";

export function escapeTitle(title: string): string {
  return title
    .replace(/\|/g, "/")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/#(?=\w)/g, "＃");
}

export function buildChronosSource(
  nodes: TimelineNode[],
  erasAsBackground: boolean,
): { source: string; uuidByIndex: string[] } {
  const lines = ["> NOTODAY"];
  const uuidByIndex: string[] = [];
  for (const n of nodes) {
    const date = n.date!.trim();
    const isRange = date.includes("~");
    const prefix = erasAsBackground && n.type === "era" && isRange ? "@" : "-";
    const escaped = escapeTitle(n.title);
    const title = escaped.trim() === "" ? "(untitled)" : escaped; // matches attention.ts's convention
    lines.push(`${prefix} [${date}] ${title}`);
    uuidByIndex.push(n.uuid);
  }
  return { source: lines.join("\n"), uuidByIndex };
}
