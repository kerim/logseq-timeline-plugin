import { PROP_DATE, PROP_TOPIC, PROP_TYPE } from "../constants";

export interface PropSchema {
  date: string;
  topic: string;
  type: string;
}

// Pull-result maps use mixed key shapes (poc-findings.md a / a2):
// built-in attrs come back bare (`title`, `uuid`, `ident`); user-property
// attrs come back keyed by the FULL colon-prefixed ident. Try bare key,
// then the bare trailing segment, then the colon-prefixed form.
const k = (o: Record<string, unknown>, key: string): unknown =>
  o[key] ?? o[key.split("/").pop()!] ?? o[":" + key];

export async function discoverSchema(): Promise<PropSchema | null> {
  // Plugin-created properties (via logseq.Editor.upsertProperty, see
  // ./setup.ts) may land in a "plugin.property.*" namespace instead of
  // "user.property" — accept either.
  const rows: unknown[][] = (await logseq.DB.datascriptQuery(`
    [:find (pull ?p [:db/ident :block/title])
     :where [?p :db/ident ?i] [(namespace ?i) ?ns]
     (or [(= ?ns "user.property")] [(clojure.string/starts-with? ?ns "plugin.property")])]`)) ?? [];
  const props = rows.map((r) => r[0] as Record<string, unknown>);
  const identFor = (title: string): string | undefined => {
    const hit = props.find((p) => k(p, "block/title") === title);
    return hit ? String(k(hit, "db/ident")) : undefined;
  };
  const date = identFor(PROP_DATE);
  const topic = identFor(PROP_TOPIC);
  const type = identFor(PROP_TYPE);
  return date && topic && type ? { date, topic, type } : null;
}
