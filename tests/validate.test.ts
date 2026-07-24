import { describe, it, expect } from "vitest";
import { TL_DATE_RE, partitionNodes } from "../src/core/validate";
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
