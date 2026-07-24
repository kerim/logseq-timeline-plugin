export type TlType = "event" | "era" | "person";

export interface TimelineNode {
  uuid: string;
  title: string;
  date: string | null;
  topics: { title: string; uuid: string }[];
  type: TlType | null;
}

export interface Filters {
  topics: string[];          // selected topic titles; empty = all
  topicMode: "AND" | "OR";
  types: string[];           // checked TlType values; empty = all
  erasAsBackground: boolean;
}

export type PersistedState = Filters;

export interface AttentionEntry {
  node: TimelineNode;
  reason: "missing-date" | "invalid-date";
}
