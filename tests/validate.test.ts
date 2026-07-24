import { describe, it, expect } from "vitest";
import { TL_DATE_RE, isSemanticallyValidDate, partitionNodes } from "../src/core/validate";
import type { TimelineNode } from "../src/types";

const node = (over: Partial<TimelineNode>): TimelineNode => ({
  uuid: "u1", title: "T", date: "1874", topics: [], type: "event", ...over,
});

describe("TL_DATE_RE", () => {
  it.each(["1874", "1874-05", "1874-05-22", "-500", "1895~1945", "1895 ~ 1945",
           "-500~-20", "1874-05-22T14:30", "271821"])("accepts %s", (d) => {
    expect(TL_DATE_RE.test(d)).toBe(true);
  });
  it.each(["", "May 1874", "1874-5", "1874/1945", "1874~", "~1945", "1874-05-22-01"])(
    "rejects %s", (d) => { expect(TL_DATE_RE.test(d)).toBe(false); });
});

describe("partitionNodes", () => {
  it("splits renderable / missing / invalid", () => {
    const good = node({ uuid: "a" });
    const missing = node({ uuid: "b", date: null });
    const bad = node({ uuid: "c", date: "sometime in spring" });
    const { renderable, attention } = partitionNodes([good, missing, bad]);
    expect(renderable).toEqual([good]);
    expect(attention).toEqual([
      { node: missing, reason: "missing-date" },
      { node: bad, reason: "invalid-date" },
    ]);
  });
});

describe("isSemanticallyValidDate", () => {
  it.each([
    ["1874-13", false],
    ["1874-02-35", false],
    ["1945~1895", false],
    ["-500~-20", true],
    ["-20~-500", false],
    ["1874~1874", true],
    ["1874-05-22T14:30", true],
  ] as const)("%s -> %s", (d, expected) => {
    expect(isSemanticallyValidDate(d)).toBe(expected);
  });
});

describe("partitionNodes semantic validation", () => {
  it.each(["1874-13", "1874-02-35", "1945~1895", "-20~-500"])(
    "flags %s as invalid-date (syntactically valid, semantically nonsense)",
    (date) => {
      const bad = node({ uuid: "d", date });
      const { renderable, attention } = partitionNodes([bad]);
      expect(renderable).toEqual([]);
      expect(attention).toEqual([{ node: bad, reason: "invalid-date" }]);
    },
  );

  it.each(["-500~-20", "1874~1874", "1874-05-22T14:30"])(
    "keeps %s renderable",
    (date) => {
      const good = node({ uuid: "e", date });
      const { renderable, attention } = partitionNodes([good]);
      expect(renderable).toEqual([good]);
      expect(attention).toEqual([]);
    },
  );
});
