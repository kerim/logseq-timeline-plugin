import { describe, it, expect } from "vitest";
import { buildIdMap } from "../src/ui/timeline";

describe("buildIdMap", () => {
  it("zips ids to uuids in order", () => {
    const m = buildIdMap([101, 102, 103], ["a", "b", "c"]);
    expect(m?.get(102)).toBe("b");
  });
  it("returns null on count mismatch (renderer dropped a line)", () => {
    expect(buildIdMap([101], ["a", "b"])).toBeNull();
  });
});
