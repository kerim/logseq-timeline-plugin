# POC Findings — live-graph probe results

Date: 2026-07-24 · Probe run by user against a test DB graph · Logseq desktop, `@logseq/libs` 0.3.4.

## (e) DB-graph detection — RESOLVED ✓
`logseq.App.checkCurrentIsDbGraph()` exists, is typed in current `@logseq/libs`, and returned `true`. Use it directly in Task 9; keep the try/catch fallback (assume DB, let query errors surface) for older API versions.

## (a) datascriptQuery result key shape — RESOLVED ✓ (round 1), property-value keys pending round 2
**Pull-result maps use BARE key names — namespace stripped, no leading colon.**

Evidence (ident discovery rows, verbatim):
```json
{ "title": "tl-date", "ident": ":user.property/tl-date-yA0s4uuH" }
```
- `:block/title` → key `title`; `:db/ident` → key `ident`.
- Ident **values** DO carry the leading colon (`":user.property/tl-date-yA0s4uuH"`) — interpolate into query text as-is.
- User-property idents are UUID-suffixed (`tl-date-yA0s4uuH`, `tl-topic-GMEFEZYY`, `tl-type-iA7wcZJ-`) — discovery-by-title is mandatory, as designed.
- **Task 6 impact:** `normalizeRow`/`k()` must read bare keys (`title`, `uuid`) and, for property values, expect the key to be the ident's bare name segment (e.g. `tl-date-yA0s4uuH`) — CONFIRM in round 2 (node query never ran in round 1 due to the key-shape bug, fixed in 490cca2). Test fixtures in Task 6 must mirror the bare-key shape.

## (b) renderChronos parsed order/ids — RESOLVED ✓
`parsed` = `{ items: [...], markers: [], groups: [], flags: {noToday: true} }`.
- `items` is in **source order** (BCE event, Era wash, Mudan Incident — matching input line order).
- Every item carries a parser-generated `id` (UUID string) → `buildIdMap(items.map(i => i.id), uuidByIndex)` works as designed.
- Flags don't consume item slots. Era (`@`) lines DO appear in `items`, with `"type": "background"`.
- **Task 7 caveat:** background-type items may be non-interactive in vis-timeline (era washes likely won't fire click/itemover). Acceptable v1 behavior; do not treat as a routing bug.
- BCE start serialized as expanded-year ISO (`"-000500-01-01T00:00:00.000Z"`) — parser handles negative years correctly.

## (d) BCE axis rendering — RESOLVED ✓
Readable: BCE point sits at −0500; axis ticks `-0500, 0000, 0500, 1000, 1500`. Astronomical year 0000 appears (known vis-timeline quirk) — cosmetic, acceptable for v1.

## (c) Navigation (pushState / sidebar with uuid) — PENDING round 2
Round-1 buttons received `undefined` uuids (key-shape bug), so navigation is unverified. Round 2: buttons will carry real uuid/title; user reports whether `logseq.App.pushState("page", {name: uuid})` opens block nodes and whether `openInRightSidebar(uuid)` works.

## Round-2 open items
1. Node-query result: exact key for user-property values in nested pulls (expected: bare ident segment like `tl-date-yA0s4uuH`), value shapes for tl-topic (array vs object) and tl-type (choice → object with `title`?).
2. Navigation verification (c).
