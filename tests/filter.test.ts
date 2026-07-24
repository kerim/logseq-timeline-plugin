import { describe, it, expect } from "vitest";
import { applyFilters } from "../src/core/filter";
import type { Filters, TimelineNode } from "../src/types";

const n = (uuid: string, topics: string[], type: TimelineNode["type"]): TimelineNode => ({
  uuid, title: uuid, date: "1900", type,
  topics: topics.map((t) => ({ title: t, uuid: `p-${t}` })),
});
const f = (over: Partial<Filters>): Filters =>
  ({ topics: [], topicMode: "OR", types: [], erasAsBackground: true, ...over });

const mudan = n("mudan", ["Japan", "Taiwan"], "event");
const meiji = n("meiji", ["Japan"], "event");
const colonial = n("colonial", ["Taiwan"], "era");
const all = [mudan, meiji, colonial];

describe("applyFilters", () => {
  it("empty filters pass everything", () => {
    expect(applyFilters(all, f({}))).toEqual(all);
  });
  it("OR topics = union", () => {
    expect(applyFilters(all, f({ topics: ["Japan", "Taiwan"] }))).toEqual(all);
  });
  it("AND topics = intersection", () => {
    expect(applyFilters(all, f({ topics: ["Japan", "Taiwan"], topicMode: "AND" }))).toEqual([mudan]);
  });
  it("type filter", () => {
    expect(applyFilters(all, f({ types: ["era"] }))).toEqual([colonial]);
  });
  it("topics AND types compose", () => {
    expect(applyFilters(all, f({ topics: ["Taiwan"], types: ["event"] }))).toEqual([mudan]);
  });
  it("typed filter excludes null-type nodes", () => {
    const untyped = n("untyped", ["Japan"], null);
    expect(applyFilters([untyped], f({ types: ["event"] }))).toEqual([]);
  });
});
