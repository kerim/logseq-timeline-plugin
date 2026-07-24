import { TAG_TITLE } from "../constants";
import type { TimelineNode, TlType } from "../types";
import type { PropSchema } from "./schema";

// Same three-way key helper as schema.ts (poc-findings.md a / a2): bare key,
// then bare trailing segment, then colon-prefixed full ident.
const k = (o: Record<string, unknown>, key: string): unknown =>
  o[key] ?? o[key.split("/").pop()!] ?? o[":" + key];

const bare = (ident: string) => ident.replace(/^:/, "");

const TYPES: TlType[] = ["event", "era", "person"];

export function normalizeRow(row: unknown, schema: PropSchema): TimelineNode {
  const o = (row as unknown[])[0] as Record<string, unknown>;

  const ref = (v: unknown) => {
    const r = v as Record<string, unknown>;
    return { title: String(k(r, "block/title") ?? ""), uuid: String(k(r, "block/uuid") ?? "") };
  };

  const rawTopics = k(o, bare(schema.topic));
  const topics = rawTopics == null ? [] : (Array.isArray(rawTopics) ? rawTopics : [rawTopics]).map(ref);

  const rawType = k(o, bare(schema.type));
  const typeTitle = rawType == null ? null : ref(rawType).title;

  // tl-date is ref-typed like everything else (Text/:default props store refs
  // to hidden value-entities; the value-entity's :block/title holds the
  // text). Tolerate three shapes: bare string (defensive), nested-pull
  // object with a title, or anything else -> null (needs-attention).
  const rawDate = k(o, bare(schema.date));
  let date: string | null = null;
  if (typeof rawDate === "string") {
    date = rawDate;
  } else if (rawDate != null) {
    const t = k(rawDate as Record<string, unknown>, "block/title");
    if (typeof t === "string") date = t;
  }

  return {
    uuid: String(k(o, "block/uuid") ?? ""),
    title: String(k(o, "block/title") ?? ""),
    date,
    topics,
    type: typeTitle !== null && (TYPES as string[]).includes(typeTitle) ? (typeTitle as TlType) : null,
  };
}

export async function fetchTimelineNodes(schema: PropSchema): Promise<TimelineNode[]> {
  const q = `[:find (pull ?b [:block/uuid :block/title
      {${schema.date} [:block/title]}
      {${schema.topic} [:block/title :block/uuid]}
      {${schema.type} [:block/title]}])
    :where [?b :block/tags ?tag] [?tag :block/title "${TAG_TITLE}"]]`;
  const rows: unknown[] = (await logseq.DB.datascriptQuery(q)) ?? [];
  return rows.map((r) => normalizeRow(r, schema));
}
