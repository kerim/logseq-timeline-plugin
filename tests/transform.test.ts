import { describe, it, expect } from "vitest";
import { buildChronosSource, escapeTitle } from "../src/core/transform";
import type { TimelineNode } from "../src/types";

const n = (over: Partial<TimelineNode>): TimelineNode => ({
  uuid: "u", title: "T", date: "1874", topics: [], type: "event", ...over,
});

describe("escapeTitle", () => {
  it("neutralizes chronos syntax characters", () => {
    expect(escapeTitle("A|B {C} #red")).toBe("A/B (C) ＃red");
  });
  it("leaves plain titles alone", () => {
    expect(escapeTitle("Mudan Incident")).toBe("Mudan Incident");
  });
});

describe("buildChronosSource", () => {
  it("emits NOTODAY flag then one line per node, tracking uuids", () => {
    const { source, uuidByIndex } = buildChronosSource(
      [n({ uuid: "a", title: "Mudan Incident", date: "1874-05-22" }),
       n({ uuid: "b", title: "Colonial period", date: "1895~1945", type: "era" })],
      true,
    );
    expect(source.split("\n")).toEqual([
      "> NOTODAY",
      "- [1874-05-22] Mudan Incident",
      "@ [1895~1945] Colonial period",
    ]);
    expect(uuidByIndex).toEqual(["a", "b"]);
  });

  it("era renders as event when toggle off", () => {
    const { source } = buildChronosSource([n({ date: "1895~1945", type: "era" })], false);
    expect(source).toContain("- [1895~1945]");
    expect(source).not.toContain("@ [");
  });

  it("single-date era falls back to event line (periods need ranges)", () => {
    const { source } = buildChronosSource([n({ date: "1874", type: "era" })], true);
    expect(source).toContain("- [1874]");
  });

  it("person renders as plain event line", () => {
    const { source } = buildChronosSource([n({ date: "1820~1890", type: "person" })], true);
    expect(source).toContain("- [1820~1890]");
  });
});
