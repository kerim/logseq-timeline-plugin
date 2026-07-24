# Logseq Timeline Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Logseq DB-graph plugin that renders `#tl`-tagged nodes as an interactive, filterable historical timeline, with click-through back to the graph.

**Architecture:** Pure-TS core (filter/validate/transform) feeding `chronos-timeline-md` (ISC; vis-timeline underneath) inside the plugin's main-UI iframe. One Datalog query fetches all `#tl` nodes; filtering happens in JS; the renderer's event stream routes clicks/hovers back to Logseq nodes via an index→uuid map.

**Tech Stack:** TypeScript (strict) · Vite · `@logseq/libs` ≥ 0.3.0 · `chronos-timeline-md` · Vitest.

**Spec:** `docs/superpowers/specs/2026-07-24-logseq-timeline-plugin-design.md` (approved 2026-07-24).

## Global Constraints

- **DB graphs only.** On a file-based graph, show a notice and do nothing else. `@logseq/libs` ≥ **0.3.0**.
- **Renderer:** `chronos-timeline-md` only (ISC). Never import `vis-timeline` directly (it's the library's peer dep).
- **Naming:** tag title is exactly `tl`; property titles are exactly `tl-date`, `tl-topic`, `tl-type`. All future properties take the `tl-` prefix.
- **Plugin never mutates user content.** Read-only against the graph (v1 has no schema auto-setup; onboarding is instructions-only pending POC findings).
- **v1 exclusions (spec):** no colors, no swimlanes, no saved presets, no in-page embedding, no Markwhen export.
- **`tl-type` vocabulary:** `event` | `era` | `person`.
- **Versioning:** `package.json` version starts `0.0.1`; bump patch at every task's commit that changes shipped code; final release task sets `0.1.0`. Never reuse a version.
- **Sandbox note for executors:** `pnpm install` requires `dangerouslyDisableSandbox: true` (user's standing rule). All other commands run sandboxed.
- **User verification gates:** Tasks marked "USER VERIFY" require the user to test in Logseq desktop and confirm before the task is committed as done.

## File Structure

```
logseq-timeline-plugin/
├── package.json              # plugin manifest (logseq key) + deps + version
├── vite.config.ts
├── tsconfig.json
├── index.html                # plugin iframe entry
├── src/
│   ├── main.ts               # bootstrap: toolbar button, show/hide UI, theme sync
│   ├── constants.ts          # tag/property titles, settings key, defaults
│   ├── types.ts              # TimelineNode, Filters, PersistedState, Schema
│   ├── logseq/
│   │   ├── schema.ts         # property-ident discovery by title
│   │   ├── query.ts          # fetch #tl nodes → TimelineNode[]
│   │   └── navigate.ts       # openNode / openInSidebar / getPreviewText
│   ├── core/
│   │   ├── validate.ts       # date regex, partition renderable vs needs-attention
│   │   ├── filter.ts         # pure filter engine (topics AND/OR × types)
│   │   └── transform.ts      # nodes → chronos source + uuidByIndex map
│   └── ui/
│       ├── app.ts            # panel orchestration + state
│       ├── filterBar.ts      # topic multi-select, AND/OR, types, era toggle, refresh
│       ├── timeline.ts       # renderChronos wrapper, id→uuid map, event wiring
│       ├── attention.ts      # needs-attention list
│       └── styles.css        # layout + --chronos-* theme vars (light/dark)
├── tests/
│   ├── validate.test.ts
│   ├── filter.test.ts
│   ├── transform.test.ts
│   ├── timeline-map.test.ts
│   └── query-normalize.test.ts
└── docs/superpowers/
    ├── specs/2026-07-24-logseq-timeline-plugin-design.md
    ├── plans/2026-07-24-logseq-timeline-plugin.md   (this file)
    └── poc-findings.md       # created by Task 2
```

---

### Task 1: Project scaffold + toolbar button + empty overlay

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/ui/styles.css`, `.gitignore`

**Interfaces:**
- Produces: a loadable Logseq plugin whose toolbar button toggles a full-window overlay iframe. `logseq` global available in all later `src/logseq/*` and `src/main.ts` code.

- [ ] **Step 1: Write config files**

`package.json`:
```json
{
  "name": "logseq-timeline-plugin",
  "version": "0.0.1",
  "description": "Historical timelines from #tl-tagged nodes (Logseq DB graphs only)",
  "main": "dist/index.html",
  "scripts": {
    "dev": "vite build --watch",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run"
  },
  "logseq": {
    "id": "logseq-timeline-plugin",
    "title": "Timeline",
    "icon": "./icon.svg",
    "main": "dist/index.html"
  },
  "dependencies": {
    "@logseq/libs": "^0.3.1",
    "chronos-timeline-md": "^1.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

`vite.config.ts`:
```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { target: "es2020" },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

`.gitignore`:
```
node_modules/
dist/
```

`index.html`:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Timeline</title>
    <link rel="stylesheet" href="./src/ui/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

Also create `icon.svg` (any simple timeline glyph, e.g.):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/></svg>
```

- [ ] **Step 2: Write `src/main.ts` (bootstrap only)**

```ts
import "@logseq/libs";

function openPanel() {
  logseq.showMainUI();
}

function main() {
  logseq.provideModel({ openTimeline: openPanel });

  logseq.App.registerUIItem("toolbar", {
    key: "timeline-open",
    template: `<a data-on-click="openTimeline" class="button" title="Open timeline">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/></svg>
    </a>`,
  });

  logseq.setMainUIInlineStyle({ zIndex: 11 });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") logseq.hideMainUI();
  });

  const app = document.getElementById("app")!;
  app.innerHTML = `<div class="tlp-panel"><header class="tlp-header">
      <span>Timeline</span>
      <button id="tlp-close" title="Close">✕</button>
    </header><main id="tlp-body">Scaffold OK</main></div>`;
  document.getElementById("tlp-close")!.addEventListener("click", () => logseq.hideMainUI());
}

logseq.ready(main).catch(console.error);
```

`src/ui/styles.css` (minimal for now):
```css
:root { --tlp-bg: #ffffff; --tlp-fg: #222; --tlp-border: #d0d0d0; }
html[data-theme="dark"] { --tlp-bg: #1f1f1f; --tlp-fg: #ddd; --tlp-border: #444; }
html, body { margin: 0; height: 100%; }
.tlp-panel { display: flex; flex-direction: column; height: 100vh; background: var(--tlp-bg); color: var(--tlp-fg); font-family: sans-serif; }
.tlp-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--tlp-border); }
#tlp-body { flex: 1; overflow: auto; padding: 12px; }
```

- [ ] **Step 3: Install and build**

Run: `pnpm install` (needs `dangerouslyDisableSandbox: true`), then `pnpm build`
Expected: `dist/index.html` produced, no TS errors.

- [ ] **Step 4: USER VERIFY — load in Logseq**

Ask the user to: Logseq → Settings → enable Developer mode → Plugins → Load unpacked plugin → select the repo folder. Confirm: toolbar shows the timeline button; clicking opens the full-window overlay saying "Scaffold OK"; ✕ and Escape close it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: plugin scaffold with toolbar button and overlay shell (v0.0.1)"
```

---

### Task 2: POC probe — burn down the spec's four open risks

**Files:**
- Create: `src/poc.ts`
- Modify: `src/main.ts` (temporary probe button in the panel body)
- Create (findings): `docs/superpowers/poc-findings.md`

**Interfaces:**
- Produces: verified facts recorded in `poc-findings.md` that Tasks 6–8 depend on: (a) exact JSON key shape of `datascriptQuery` pull results, (b) whether `renderChronos().parsed.items` is in source order and what `id` each item carries, (c) whether `logseq.App.pushState("page", {name: <uuid>})` opens a block node (else fallback `scrollToBlockInPage`), (d) how BCE axis labels look, (e) whether `logseq.App.checkCurrentIsDbGraph()` exists and works.

**Prerequisite (user, one-time, ~1 minute):** in the test graph create tag `#tl`; on its tag page add properties `tl-date` (Text), `tl-topic` (Node, "multiple values" ON), `tl-type` (Text with choices `event`, `era`, `person`). Create 3 sample nodes: `Mudan Incident #tl` (`tl-date` `1874-05-22`, `tl-topic` [[Japan]] + [[Taiwan]], `tl-type` event); `Japanese colonial period #tl` (`tl-date` `1895~1945`, type era); `Ancient test #tl` (`tl-date` `-500`, type event).

- [ ] **Step 1: Write `src/poc.ts`**

```ts
import { renderChronos } from "chronos-timeline-md";

export async function runProbe(out: HTMLElement) {
  const log = (label: string, v: unknown) => {
    out.insertAdjacentHTML("beforeend", `<h4>${label}</h4><pre>${
      typeof v === "string" ? v : JSON.stringify(v, null, 2)
    }</pre>`);
    console.log("[tlp-poc]", label, v);
  };

  // (e) DB-graph detection
  try {
    // @ts-expect-error probe: may not exist in typings
    log("checkCurrentIsDbGraph", await logseq.App.checkCurrentIsDbGraph());
  } catch (e) { log("checkCurrentIsDbGraph FAILED", String(e)); }

  // (a) ident discovery — exact key shape matters
  const props = await logseq.DB.datascriptQuery(`
    [:find (pull ?p [:db/ident :block/title])
     :where [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")]]`);
  log("user.property idents (raw)", props);

  const flat: Array<Record<string, unknown>> = (props ?? []).map((r: unknown[]) => r[0] as Record<string, unknown>);
  const identOf = (title: string) =>
    flat.find((p) => p["block/title"] === title || p[":block/title"] === title);
  const d = identOf("tl-date"), t = identOf("tl-topic"), ty = identOf("tl-type");
  log("resolved idents", { d, t, ty });

  // (a) full node query with nested pulls
  if (d && t && ty) {
    const ident = (p: Record<string, unknown>) => String(p["db/ident"] ?? p[":db/ident"]);
    const q = `[:find (pull ?b [:block/uuid :block/title
        ${ident(d)}
        {${ident(t)} [:block/title :block/uuid]}
        {${ident(ty)} [:block/title]}])
      :where [?b :block/tags ?tag] [?tag :block/title "tl"]]`;
    log("node query", q);
    log("node query result (raw)", await logseq.DB.datascriptQuery(q));
  }

  // (b)+(d) renderer probe: order, ids, BCE axis
  const container = document.createElement("div");
  container.style.height = "300px";
  out.appendChild(container);
  const src = ["> NOTODAY", "- [-500] BCE event", "@ [1895~1945] Era wash", "- [1874-05-22] Mudan Incident"].join("\n");
  const { parsed } = renderChronos(container, src, {});
  log("parsed (order + ids?)", parsed);

  // (c) navigation probes — buttons so user can eyeball each behavior
  const rows = (await logseq.DB.datascriptQuery(
    `[:find (pull ?b [:block/uuid :block/title])
      :where [?b :block/tags ?tag] [?tag :block/title "tl"]]`)) ?? [];
  for (const [node] of rows as Array<[Record<string, string>]>) {
    const uuid = node["block/uuid"] ?? node[":block/uuid"];
    const title = node["block/title"] ?? node[":block/title"];
    const btn = document.createElement("button");
    btn.textContent = `pushState → ${title}`;
    btn.onclick = () => { logseq.hideMainUI(); logseq.App.pushState("page", { name: String(uuid) }); };
    const btn2 = document.createElement("button");
    btn2.textContent = `sidebar → ${title}`;
    btn2.onclick = () => logseq.Editor.openInRightSidebar(String(uuid));
    out.append(btn, btn2, document.createElement("br"));
  }
}
```

- [ ] **Step 2: Wire probe button into the panel body in `src/main.ts`**

Replace `Scaffold OK` body setup with:
```ts
  const body = document.getElementById("tlp-body")!;
  const probeBtn = document.createElement("button");
  probeBtn.textContent = "Run POC probe";
  probeBtn.onclick = async () => {
    body.innerHTML = "";
    const { runProbe } = await import("./poc");
    await runProbe(body);
  };
  body.append(probeBtn);
```

- [ ] **Step 3: Build**

Run: `pnpm build` — Expected: success.

- [ ] **Step 4: USER VERIFY — run probe against the test graph**

User reloads the plugin, opens panel, clicks "Run POC probe", and reports back the on-screen output (or copies the console `[tlp-poc]` lines), plus: do the pushState buttons land on the right node (blocks AND pages)? Do BCE ticks render readably? 

- [ ] **Step 5: Record findings**

Write `docs/superpowers/poc-findings.md` with: exact result-key style (`"block/uuid"` vs `":block/uuid"`), the `parsed` structure (items array? source order? id values?), which navigation call works for block nodes, `checkCurrentIsDbGraph` availability, BCE axis notes. **If any finding contradicts code in Tasks 6–8, update those tasks' code now, before execution reaches them.**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: POC probe + recorded findings (v0.0.2)"
```

---

### Task 3: Types, constants, and validate.ts (TDD)

**Files:**
- Create: `src/types.ts`, `src/constants.ts`, `src/core/validate.ts`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Produces:
  - `TimelineNode { uuid: string; title: string; date: string | null; topics: {title: string; uuid: string}[]; type: "event"|"era"|"person"|null }`
  - `Filters { topics: string[]; topicMode: "AND"|"OR"; types: string[]; erasAsBackground: boolean }`
  - `PersistedState` = `Filters` (same shape, persisted verbatim)
  - `partitionNodes(nodes: TimelineNode[]): { renderable: TimelineNode[]; attention: {node: TimelineNode; reason: "missing-date"|"invalid-date"}[] }`
  - `TL_DATE_RE: RegExp`

- [ ] **Step 1: Write `src/types.ts` and `src/constants.ts`**

`src/types.ts`:
```ts
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
```

`src/constants.ts`:
```ts
export const TAG_TITLE = "tl";
export const PROP_DATE = "tl-date";
export const PROP_TOPIC = "tl-topic";
export const PROP_TYPE = "tl-type";
export const SETTINGS_KEY = "panelState";
export const DEFAULT_FILTERS = {
  topics: [] as string[],
  topicMode: "OR" as const,
  types: [] as string[],
  erasAsBackground: true,
};
```

- [ ] **Step 2: Write the failing tests**

`tests/validate.test.ts`:
```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/validate.test.ts`
Expected: FAIL — cannot resolve `../src/core/validate`.

- [ ] **Step 4: Implement `src/core/validate.ts`**

```ts
import type { AttentionEntry, TimelineNode } from "../types";

const PART = String.raw`-?\d{1,6}(?:-\d{2}(?:-\d{2})?)?(?:T\d{2}(?::\d{2}(?::\d{2})?)?)?`;
export const TL_DATE_RE = new RegExp(`^${PART}(?:\\s*~\\s*${PART})?$`);

export function partitionNodes(nodes: TimelineNode[]): {
  renderable: TimelineNode[];
  attention: AttentionEntry[];
} {
  const renderable: TimelineNode[] = [];
  const attention: AttentionEntry[] = [];
  for (const n of nodes) {
    if (n.date === null || n.date.trim() === "") attention.push({ node: n, reason: "missing-date" });
    else if (!TL_DATE_RE.test(n.date.trim())) attention.push({ node: n, reason: "invalid-date" });
    else renderable.push(n);
  }
  return { renderable, attention };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/validate.test.ts` — Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/constants.ts src/core/validate.ts tests/validate.test.ts
git commit -m "feat: core types + tl-date validation/partition (v0.0.3)"
```

---

### Task 4: Filter engine (TDD)

**Files:**
- Create: `src/core/filter.ts`
- Test: `tests/filter.test.ts`

**Interfaces:**
- Consumes: `TimelineNode`, `Filters` from `src/types.ts`.
- Produces: `applyFilters(nodes: TimelineNode[], f: Filters): TimelineNode[]`

- [ ] **Step 1: Write the failing tests**

`tests/filter.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/filter.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/core/filter.ts`**

```ts
import type { Filters, TimelineNode } from "../types";

export function applyFilters(nodes: TimelineNode[], f: Filters): TimelineNode[] {
  return nodes.filter((n) => matchesTopics(n, f) && matchesTypes(n, f));
}

function matchesTopics(n: TimelineNode, f: Filters): boolean {
  if (f.topics.length === 0) return true;
  const titles = new Set(n.topics.map((t) => t.title));
  return f.topicMode === "AND"
    ? f.topics.every((t) => titles.has(t))
    : f.topics.some((t) => titles.has(t));
}

function matchesTypes(n: TimelineNode, f: Filters): boolean {
  if (f.types.length === 0) return true;
  return n.type !== null && f.types.includes(n.type);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/filter.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/filter.ts tests/filter.test.ts
git commit -m "feat: topic/type filter engine with AND-OR semantics (v0.0.4)"
```

---

### Task 5: Transform — nodes → Chronos source + uuid map (TDD)

**Files:**
- Create: `src/core/transform.ts`
- Test: `tests/transform.test.ts`

**Interfaces:**
- Consumes: `TimelineNode` (only nodes that passed `partitionNodes` — `date` is non-null valid).
- Produces:
  - `escapeTitle(title: string): string`
  - `buildChronosSource(nodes: TimelineNode[], erasAsBackground: boolean): { source: string; uuidByIndex: string[] }` — `uuidByIndex[i]` corresponds to the i-th item line (flags excluded).

- [ ] **Step 1: Write the failing tests**

`tests/transform.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/transform.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/core/transform.ts`**

```ts
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
    lines.push(`${prefix} [${date}] ${escapeTitle(n.title)}`);
    uuidByIndex.push(n.uuid);
  }
  return { source: lines.join("\n"), uuidByIndex };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/transform.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/transform.ts tests/transform.test.ts
git commit -m "feat: chronos source generation with era-wash toggle and uuid map (v0.0.5)"
```

---

### Task 6: Query layer — schema discovery + node fetch (TDD on normalization)

> ⚠️ Before implementing, check `docs/superpowers/poc-findings.md` (Task 2). If result keys carry a leading colon (`":block/uuid"`), adjust `k()` accordingly — the helper below handles both, but the fixture should mirror reality.

**Files:**
- Create: `src/logseq/schema.ts`, `src/logseq/query.ts`
- Test: `tests/query-normalize.test.ts`

**Interfaces:**
- Consumes: `TAG_TITLE`, `PROP_*` constants; `TimelineNode` type.
- Produces:
  - `discoverSchema(): Promise<{ date: string; topic: string; type: string } | null>` — property idents by role, `null` if any of the three properties is missing (→ onboarding).
  - `fetchTimelineNodes(schema): Promise<TimelineNode[]>`
  - `normalizeRow(row: unknown, schema): TimelineNode` (exported for tests)

- [ ] **Step 1: Write the failing normalization test**

`tests/query-normalize.test.ts` — fixture mirrors POC-recorded shape (adjust per findings):
```ts
import { describe, it, expect } from "vitest";
import { normalizeRow } from "../src/logseq/query";

const schema = {
  date: ":user.property/tl-date-x1",
  topic: ":user.property/tl-topic-x2",
  type: ":user.property/tl-type-x3",
};

describe("normalizeRow", () => {
  it("normalizes a full row (topics as array)", () => {
    const row = [{
      "block/uuid": "aaaa-bbbb",
      "block/title": "Mudan Incident",
      "user.property/tl-date-x1": "1874-05-22",
      "user.property/tl-topic-x2": [
        { "block/title": "Japan", "block/uuid": "j-1" },
        { "block/title": "Taiwan", "block/uuid": "t-1" },
      ],
      "user.property/tl-type-x3": { "block/title": "event" },
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
      "block/uuid": "u2", "block/title": "X",
      "user.property/tl-topic-x2": { "block/title": "Japan", "block/uuid": "j-1" },
      "user.property/tl-type-x3": { "block/title": "banana" },
    }];
    expect(normalizeRow(row, schema)).toEqual({
      uuid: "u2", title: "X", date: null,
      topics: [{ title: "Japan", uuid: "j-1" }], type: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/query-normalize.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/logseq/schema.ts` and `src/logseq/query.ts`**

`src/logseq/schema.ts`:
```ts
import { PROP_DATE, PROP_TOPIC, PROP_TYPE } from "../constants";

export interface PropSchema { date: string; topic: string; type: string }

const k = (o: Record<string, unknown>, key: string) => o[key] ?? o[`:${key}`];

export async function discoverSchema(): Promise<PropSchema | null> {
  const rows: unknown[][] = (await logseq.DB.datascriptQuery(`
    [:find (pull ?p [:db/ident :block/title])
     :where [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")]]`)) ?? [];
  const props = rows.map((r) => r[0] as Record<string, unknown>);
  const identFor = (title: string): string | undefined => {
    const hit = props.find((p) => k(p, "block/title") === title);
    return hit ? String(k(hit, "db/ident")) : undefined;
  };
  const date = identFor(PROP_DATE), topic = identFor(PROP_TOPIC), type = identFor(PROP_TYPE);
  return date && topic && type ? { date, topic, type } : null;
}
```

`src/logseq/query.ts`:
```ts
import { TAG_TITLE } from "../constants";
import type { TimelineNode, TlType } from "../types";
import type { PropSchema } from "./schema";

const k = (o: Record<string, unknown>, key: string) => o[key] ?? o[`:${key}`];
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
  const rawDate = k(o, bare(schema.date));
  return {
    uuid: String(k(o, "block/uuid") ?? ""),
    title: String(k(o, "block/title") ?? ""),
    date: rawDate == null ? null : String(rawDate),
    topics,
    type: typeTitle !== null && (TYPES as string[]).includes(typeTitle) ? (typeTitle as TlType) : null,
  };
}

export async function fetchTimelineNodes(schema: PropSchema): Promise<TimelineNode[]> {
  const q = `[:find (pull ?b [:block/uuid :block/title
      ${schema.date}
      {${schema.topic} [:block/title :block/uuid]}
      {${schema.type} [:block/title]}])
    :where [?b :block/tags ?tag] [?tag :block/title "${TAG_TITLE}"]]`;
  const rows: unknown[] = (await logseq.DB.datascriptQuery(q)) ?? [];
  return rows.map((r) => normalizeRow(r, schema));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/query-normalize.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/logseq/schema.ts src/logseq/query.ts tests/query-normalize.test.ts
git commit -m "feat: property-ident discovery and #tl node query with normalization (v0.0.6)"
```

---

### Task 7: Renderer wrapper + id→uuid mapping (TDD on the pure part)

> ⚠️ Check `poc-findings.md` for the actual `parsed` shape. The code assumes `parsed.items` is an array in source order whose entries carry `id`. If POC showed otherwise, adapt `buildIdMap` call site (the pure function itself only needs *some* ordered id list).

**Files:**
- Create: `src/ui/timeline.ts`
- Test: `tests/timeline-map.test.ts`

**Interfaces:**
- Consumes: `buildChronosSource` output `{ source, uuidByIndex }`.
- Produces:
  - `buildIdMap(itemIds: unknown[], uuidByIndex: string[]): Map<unknown, string> | null` — `null` on length mismatch.
  - `mountTimeline(container: HTMLElement, build: {source: string; uuidByIndex: string[]}, cb: TimelineCallbacks): { destroy(): void } | { error: string }`
  - `TimelineCallbacks { onOpen(uuid: string, inSidebar: boolean): void; onHover(uuid: string | null): void }`

- [ ] **Step 1: Write the failing test for the pure mapper**

`tests/timeline-map.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/timeline-map.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/ui/timeline.ts`**

```ts
import { renderChronos } from "chronos-timeline-md";

export interface TimelineCallbacks {
  onOpen(uuid: string, inSidebar: boolean): void;
  onHover(uuid: string | null): void;
}

export function buildIdMap(itemIds: unknown[], uuidByIndex: string[]): Map<unknown, string> | null {
  if (itemIds.length !== uuidByIndex.length) return null;
  return new Map(itemIds.map((id, i) => [id, uuidByIndex[i]]));
}

export function mountTimeline(
  container: HTMLElement,
  build: { source: string; uuidByIndex: string[] },
  cb: TimelineCallbacks,
): { destroy(): void } | { error: string } {
  const { timeline, parsed } = renderChronos(container, build.source, {});
  const items: Array<{ id: unknown }> = (parsed as { items?: Array<{ id: unknown }> }).items ?? [];
  const map = buildIdMap(items.map((i) => i.id), build.uuidByIndex);
  if (!map) {
    timeline.destroy?.();
    return { error: `Renderer item count (${items.length}) does not match node count (${build.uuidByIndex.length}). Check tl-date values.` };
  }

  timeline.on("click", (e: { item?: unknown; event?: MouseEvent & { srcEvent?: MouseEvent } }) => {
    if (e.item == null) return;
    const uuid = map.get(e.item);
    if (!uuid) return;
    const shift = Boolean(e.event?.shiftKey ?? e.event?.srcEvent?.shiftKey);
    cb.onOpen(uuid, shift);
  });
  timeline.on("itemover", (e: { item: unknown }) => {
    const uuid = map.get(e.item);
    if (uuid) cb.onHover(uuid);
  });
  timeline.on("itemout", () => cb.onHover(null));

  return { destroy: () => timeline.destroy?.() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/timeline-map.test.ts` — Expected: PASS. Also run `pnpm build` — Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add src/ui/timeline.ts tests/timeline-map.test.ts
git commit -m "feat: renderer wrapper with id-to-uuid routing and mismatch guard (v0.0.7)"
```

---

### Task 8: Navigation + hover preview helpers

**Files:**
- Create: `src/logseq/navigate.ts`

**Interfaces:**
- Consumes: POC finding (c) — which call opens block nodes.
- Produces:
  - `openNode(uuid: string): void` (hides main UI first)
  - `openInSidebar(uuid: string): void`
  - `getPreviewText(uuid: string): Promise<string>` — title + up to 240 chars of first child content, or `""` on failure.

- [ ] **Step 1: Implement `src/logseq/navigate.ts`**

```ts
export function openNode(uuid: string): void {
  logseq.hideMainUI();
  // POC finding (c): if pushState fails for blocks, swap to
  // logseq.Editor.scrollToBlockInPage(pageName, uuid) per recorded findings.
  logseq.App.pushState("page", { name: uuid });
}

export function openInSidebar(uuid: string): void {
  logseq.Editor.openInRightSidebar(uuid);
}

export async function getPreviewText(uuid: string): Promise<string> {
  try {
    const block = await logseq.Editor.getBlock(uuid, { includeChildren: true });
    if (!block) return "";
    const first = (block.children?.[0] as { content?: string } | undefined)?.content ?? "";
    return first.slice(0, 240);
  } catch {
    return "";
  }
}
```

- [ ] **Step 2: Build check**

Run: `pnpm build` — Expected: compiles clean.

- [ ] **Step 3: Commit**

```bash
git add src/logseq/navigate.ts
git commit -m "feat: node navigation and hover-preview helpers (v0.0.8)"
```

---

### Task 9: UI shell — filter bar, attention list, orchestration, persistence, theming

**Files:**
- Create: `src/ui/app.ts`, `src/ui/filterBar.ts`, `src/ui/attention.ts`
- Modify: `src/main.ts` (replace POC wiring with app init; delete `src/poc.ts`), `src/ui/styles.css`

**Interfaces:**
- Consumes: everything above — `discoverSchema`, `fetchTimelineNodes`, `partitionNodes`, `applyFilters`, `buildChronosSource`, `mountTimeline`, `openNode`, `openInSidebar`, `getPreviewText`, `DEFAULT_FILTERS`, `SETTINGS_KEY`.
- Produces: `initApp(root: HTMLElement): Promise<void>` called from `main.ts` on each `showMainUI`.

- [ ] **Step 1: Implement `src/ui/filterBar.ts`**

```ts
import type { Filters, TimelineNode, TlType } from "../types";

export function renderFilterBar(
  host: HTMLElement,
  nodes: TimelineNode[],
  filters: Filters,
  onChange: (f: Filters) => void,
  onRefresh: () => void,
): void {
  const topicTitles = [...new Set(nodes.flatMap((n) => n.topics.map((t) => t.title)))].sort();
  const types: TlType[] = ["event", "era", "person"];
  host.innerHTML = `
    <details class="tlp-topics"><summary>Topics${filters.topics.length ? ` (${filters.topics.length})` : ""}</summary>
      <div class="tlp-topic-list">
        ${topicTitles.map((t) => `<label><input type="checkbox" data-topic="${t}"
          ${filters.topics.includes(t) ? "checked" : ""}/> ${t}</label>`).join("")}
      </div>
    </details>
    <button id="tlp-mode" title="Topic combine mode">${filters.topicMode}</button>
    <span class="tlp-types">
      ${types.map((t) => `<label><input type="checkbox" data-type="${t}"
        ${filters.types.includes(t) ? "checked" : ""}/> ${t}</label>`).join("")}
    </span>
    <label class="tlp-era"><input type="checkbox" id="tlp-erawash"
      ${filters.erasAsBackground ? "checked" : ""}/> eras as background</label>
    <button id="tlp-refresh" title="Re-query the graph">↻</button>`;

  const emit = () => {
    const topics = [...host.querySelectorAll<HTMLInputElement>("[data-topic]:checked")].map((i) => i.dataset.topic!);
    const typesChecked = [...host.querySelectorAll<HTMLInputElement>("[data-type]:checked")].map((i) => i.dataset.type!);
    const mode = (host.querySelector("#tlp-mode") as HTMLButtonElement).textContent as "AND" | "OR";
    const era = (host.querySelector("#tlp-erawash") as HTMLInputElement).checked;
    onChange({ topics, topicMode: mode, types: typesChecked, erasAsBackground: era });
  };
  host.querySelectorAll("input").forEach((i) => i.addEventListener("change", emit));
  host.querySelector("#tlp-mode")!.addEventListener("click", (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.textContent = b.textContent === "OR" ? "AND" : "OR";
    emit();
  });
  host.querySelector("#tlp-refresh")!.addEventListener("click", onRefresh);
}
```

- [ ] **Step 2: Implement `src/ui/attention.ts`**

```ts
import type { AttentionEntry } from "../types";
import { openNode } from "../logseq/navigate";

export function renderAttention(host: HTMLElement, entries: AttentionEntry[]): void {
  if (entries.length === 0) { host.innerHTML = ""; return; }
  host.innerHTML = `<details class="tlp-attention">
    <summary>⚠ ${entries.length} entr${entries.length === 1 ? "y" : "ies"} need attention</summary>
    <ul>${entries.map((e, i) =>
      `<li><a href="#" data-i="${i}">${e.node.title || "(untitled)"}</a> — ${
        e.reason === "missing-date" ? "no tl-date" : `invalid tl-date: “${e.node.date}”`}</li>`).join("")}
    </ul></details>`;
  host.querySelectorAll<HTMLAnchorElement>("a[data-i]").forEach((a) =>
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      openNode(entries[Number(a.dataset.i)].node.uuid);
    }));
}
```

- [ ] **Step 3: Implement `src/ui/app.ts`**

```ts
import { DEFAULT_FILTERS, SETTINGS_KEY } from "../constants";
import { applyFilters } from "../core/filter";
import { buildChronosSource } from "../core/transform";
import { partitionNodes } from "../core/validate";
import { getPreviewText, openInSidebar, openNode } from "../logseq/navigate";
import { fetchTimelineNodes } from "../logseq/query";
import { discoverSchema } from "../logseq/schema";
import type { Filters, TimelineNode } from "../types";
import { renderAttention } from "./attention";
import { renderFilterBar } from "./filterBar";
import { mountTimeline } from "./timeline";

let mounted: { destroy(): void } | null = null;

function loadFilters(): Filters {
  const saved = (logseq.settings?.[SETTINGS_KEY] ?? {}) as Partial<Filters>;
  return { ...DEFAULT_FILTERS, ...saved };
}
function saveFilters(f: Filters): void {
  logseq.updateSettings({ [SETTINGS_KEY]: f });
}

const ONBOARDING_HTML = `<div class="tlp-message"><h3>Timeline setup needed</h3>
  <p>This graph is missing the <code>#tl</code> schema. One-time setup (~1 minute):</p>
  <ol>
    <li>Create a tag named <code>tl</code> (type <code>#tl</code> in any block).</li>
    <li>On the <code>tl</code> tag page, add three tag properties:
      <ul>
        <li><code>tl-date</code> — type <b>Text</b></li>
        <li><code>tl-topic</code> — type <b>Node</b>, enable <b>multiple values</b></li>
        <li><code>tl-type</code> — type <b>Text</b> with choices <code>event</code>, <code>era</code>, <code>person</code></li>
      </ul></li>
    <li>Tag a node with <code>#tl</code>, fill in <code>tl-date</code>, and reopen this panel.</li>
  </ol></div>`;

export async function initApp(root: HTMLElement): Promise<void> {
  root.innerHTML = `<div class="tlp-panel">
    <header class="tlp-header">
      <span>Timeline</span>
      <nav id="tlp-filters"></nav>
      <button id="tlp-close" title="Close">✕</button>
    </header>
    <div id="tlp-attention"></div>
    <main id="tlp-canvas"></main>
    <div id="tlp-tooltip" class="tlp-tooltip" hidden></div>
  </div>`;
  root.querySelector("#tlp-close")!.addEventListener("click", () => logseq.hideMainUI());
  const canvas = root.querySelector<HTMLElement>("#tlp-canvas")!;

  let isDb = true;
  try {
    // @ts-expect-error availability confirmed by POC (Task 2); fallback below if absent
    isDb = await logseq.App.checkCurrentIsDbGraph();
  } catch { /* keep true; query failure below still yields a clear error */ }
  if (isDb === false) {
    canvas.innerHTML = `<div class="tlp-message">This plugin supports <b>DB graphs only</b>.</div>`;
    return;
  }

  const schema = await discoverSchema();
  if (!schema) { canvas.innerHTML = ONBOARDING_HTML; return; }

  let nodes: TimelineNode[] = [];
  try {
    nodes = await fetchTimelineNodes(schema);
  } catch (e) {
    canvas.innerHTML = `<div class="tlp-message">Query failed: ${String(e)}. Try ↻ refresh.</div>`;
    return;
  }

  let filters = loadFilters();
  const { renderable, attention } = partitionNodes(nodes);
  renderAttention(root.querySelector<HTMLElement>("#tlp-attention")!, attention);

  const rerender = () => {
    mounted?.destroy(); mounted = null;
    canvas.innerHTML = "";
    const visible = applyFilters(renderable, filters);
    if (visible.length === 0) {
      canvas.innerHTML = `<div class="tlp-message">No events match the current filters
        (${filters.topics.length || "all"} topics, ${filters.types.length || "all"} types).</div>`;
      return;
    }
    const build = buildChronosSource(visible, filters.erasAsBackground);
    const result = mountTimeline(canvas, build, {
      onOpen: (uuid, sidebar) => (sidebar ? openInSidebar(uuid) : openNode(uuid)),
      onHover: async (uuid) => {
        const tip = root.querySelector<HTMLElement>("#tlp-tooltip")!;
        if (!uuid) { tip.hidden = true; return; }
        const text = await getPreviewText(uuid);
        if (text) { tip.textContent = text; tip.hidden = false; }
      },
    });
    if ("error" in result) {
      canvas.innerHTML = `<div class="tlp-message">${result.error}</div>`;
    } else {
      mounted = result;
    }
  };

  renderFilterBar(
    root.querySelector<HTMLElement>("#tlp-filters")!,
    renderable,
    filters,
    (f) => { filters = f; saveFilters(f); rerender(); },
    () => initApp(root),          // refresh = full re-query
  );
  rerender();
}
```

- [ ] **Step 4: Rewire `src/main.ts` and delete the POC**

`src/main.ts` becomes:
```ts
import "@logseq/libs";
import { initApp } from "./ui/app";

async function syncTheme() {
  const cfg = await logseq.App.getUserConfigs();
  document.documentElement.dataset.theme = cfg.preferredThemeMode === "dark" ? "dark" : "light";
}

function main() {
  logseq.provideModel({
    openTimeline() {
      logseq.showMainUI();
      void initApp(document.getElementById("app")!);
    },
  });
  logseq.App.registerUIItem("toolbar", {
    key: "timeline-open",
    template: `<a data-on-click="openTimeline" class="button" title="Open timeline">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/></svg>
    </a>`,
  });
  logseq.setMainUIInlineStyle({ zIndex: 11 });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") logseq.hideMainUI(); });
  void syncTheme();
  logseq.App.onThemeModeChanged(({ mode }) => {
    document.documentElement.dataset.theme = mode === "dark" ? "dark" : "light";
  });
}

logseq.ready(main).catch(console.error);
```

Delete `src/poc.ts`.

- [ ] **Step 5: Extend `src/ui/styles.css`**

Append:
```css
#tlp-filters { display: flex; gap: 10px; align-items: center; flex: 1; margin: 0 16px; font-size: 13px; }
.tlp-topic-list { position: absolute; background: var(--tlp-bg); border: 1px solid var(--tlp-border);
  padding: 8px; max-height: 50vh; overflow: auto; display: flex; flex-direction: column; z-index: 20; }
#tlp-canvas { flex: 1; min-height: 0; }
.tlp-message { padding: 24px; max-width: 48em; }
.tlp-attention { padding: 4px 12px; border-bottom: 1px solid var(--tlp-border); font-size: 13px; }
.tlp-tooltip { position: fixed; bottom: 16px; left: 16px; max-width: 40em; background: var(--tlp-bg);
  color: var(--tlp-fg); border: 1px solid var(--tlp-border); border-radius: 6px; padding: 8px 10px;
  font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,.25); z-index: 30; }
/* chronos theme mapping */
:root { --chronos-bg-primary: var(--tlp-bg); --chronos-text-normal: var(--tlp-fg); }
```

- [ ] **Step 6: Full test + build**

Run: `pnpm test && pnpm build` — Expected: all unit tests pass; build clean.

- [ ] **Step 7: USER VERIFY — full flow in the test graph**

Checklist for the user: panel opens with timeline of sample entries · era shows as background wash · era toggle off → era becomes a bar · topic multi-select with AND/OR behaves per spec · type checkboxes filter · click opens node · shift-click opens sidebar · hover shows preview strip · broken-date node appears under "needs attention" and links through · filters survive close/reopen · dark/light follows Logseq.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: full timeline panel — filters, attention list, persistence, theming (v0.0.9)"
```

---

### Task 10: README, release build, version 0.1.0

**Files:**
- Create: `README.md`
- Modify: `package.json` (version)

- [ ] **Step 1: Write `README.md`**

Content must include: what the plugin does (one paragraph + a screenshot placeholder to fill after user verification); **DB graphs only** notice; the one-minute schema setup (same steps as the onboarding screen, verbatim); `tl-date` syntax table (`1874`, `1874-05`, `1874-05-22`, `1895~1945`, `-500`, optional `T14:30` time); filter semantics (topics AND/OR × types); era-wash toggle; interactions (click / shift-click / hover); credits & licenses (chronos-timeline-md ISC, vis-timeline Apache-2.0/MIT, inspired by Obsidian Chronos MIT); MIT license for this plugin + `LICENSE` file (MIT, user's name).

- [ ] **Step 2: Bump version and build**

Set `package.json` version to `0.1.0`. Run: `pnpm test && pnpm build` — Expected: green.

- [ ] **Step 3: USER VERIFY — final acceptance in the real graph**

User loads v0.1.0 against their real research graph and confirms the workflow end-to-end. Not marked complete until confirmed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README + license credits; release v0.1.0"
```

---

## Self-Review (performed at plan-writing time)

- **Spec coverage:** data model → Tasks 2 (prereq) + 6; renderer choice → Tasks 5/7; filter UI + AND/OR + era toggle → Tasks 4/9; interactions → Tasks 7/8/9; needs-attention → Tasks 3/9; theming → Tasks 1/9; error states (non-DB graph, onboarding, query failure, empty, count mismatch) → Task 9; POC risks 1–4 → Task 2; out-of-scope items → absent by design; versioning → Global Constraints + Task 10.
- **Placeholders:** none — every code step carries complete code; README step enumerates its full required content.
- **Type consistency:** `TimelineNode`/`Filters` defined once (Task 3), consumed by Tasks 4–9 with matching signatures; `buildChronosSource` return `{source, uuidByIndex}` consumed verbatim by `mountTimeline`; `PropSchema` produced by `discoverSchema`, consumed by `fetchTimelineNodes`.
- **Known deliberate dependency:** Tasks 6–8 explicitly re-check `poc-findings.md` before implementation; the plan's code is the default path, with fallbacks named inline.

## Executive Summary

This plan builds the timeline plugin in ten small steps, starting with a shell you can open from the Logseq toolbar and a short probe that tests the four things we couldn't be sure about in advance (how query results are shaped, how the renderer numbers its items, which navigation call opens a block, and how BCE dates look on the axis). The heart of the plugin — validating dates, filtering by topic and type, and turning notes into timeline text — is written as small, pure functions with tests before code, so the risky Logseq-specific parts stay thin and swappable. You are the final gate twice: once after the probe, and once using the finished panel against your real graph before we call it 0.1.0. The main trade-off is that we trust an external rendering library rather than owning the drawing code, which keeps our codebase tiny but means a renderer quirk (like the item-count mismatch we guard against) surfaces as a visible error message instead of something we can silently fix.
