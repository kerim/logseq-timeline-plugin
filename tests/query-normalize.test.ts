import { describe, it, expect } from "vitest";
import { normalizeRow } from "../src/logseq/query";

// Schema idents: role -> full colon-prefixed :db/ident value (as discoverSchema returns it).
const schema = {
  date: ":user.property/tl-date-x1",
  topic: ":user.property/tl-topic-x2",
  type: ":user.property/tl-type-x3",
};

describe("normalizeRow", () => {
  it("normalizes a full row (topics as array)", () => {
    // Mirrors poc-findings.md (a2): built-ins are bare keys (title/uuid) plus
    // bonus noise keys (content, full-title); user-property attrs are keyed by
    // the FULL colon-prefixed ident; tl-date is a nested-pull ref whose value
    // entity's block/title holds the text.
    const row = [{
      uuid: "aaaa-bbbb",
      title: "Mudan Incident",
      content: "Mudan Incident content noise",
      "full-title": "Mudan Incident full-title noise",
      ":user.property/tl-date-x1": { title: "1874-05-22" },
      ":user.property/tl-topic-x2": [
        { title: "Japan", uuid: "j-1", content: "Japan content", "full-title": "Japan full" },
        { title: "Taiwan", uuid: "t-1", content: "Taiwan content", "full-title": "Taiwan full" },
      ],
      ":user.property/tl-type-x3": { title: "event" },
    }];
    expect(normalizeRow(row, schema)).toEqual({
      uuid: "aaaa-bbbb",
      title: "Mudan Incident",
      date: "1874-05-22",
      topics: [{ title: "Japan", uuid: "j-1" }, { title: "Taiwan", uuid: "t-1" }],
      type: "event",
    });
  });

  it("tolerates single-object topic, missing date/type, unknown type value", () => {
    const row = [{
      uuid: "u2", title: "X",
      content: "X content noise", "full-title": "X full-title noise",
      ":user.property/tl-topic-x2": { title: "Japan", uuid: "j-1", content: "c", "full-title": "f" },
      ":user.property/tl-type-x3": { title: "banana" },
    }];
    expect(normalizeRow(row, schema)).toEqual({
      uuid: "u2", title: "X", date: null,
      topics: [{ title: "Japan", uuid: "j-1" }], type: null,
    });
  });

  it("tl-date value with no title (e.g. {id: 220}) normalizes to null date", () => {
    // Nested pull unexpectedly absent a title on the value-entity.
    const row = [{
      uuid: "u3", title: "Y",
      ":user.property/tl-date-x1": { id: 220 },
    }];
    expect(normalizeRow(row, schema)).toEqual({
      uuid: "u3", title: "Y", date: null, topics: [], type: null,
    });
  });

  it("tl-date as a bare scalar string is accepted defensively", () => {
    const row = [{
      uuid: "u4", title: "Z",
      ":user.property/tl-date-x1": "1874",
    }];
    expect(normalizeRow(row, schema)).toEqual({
      uuid: "u4", title: "Z", date: "1874", topics: [], type: null,
    });
  });
});
