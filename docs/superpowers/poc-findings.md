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

## (c) Navigation (pushState / sidebar with uuid) — RESOLVED ✓ (round 2)
User confirmed: `logseq.App.pushState("page", {name: uuid})` opens the right node, and `logseq.Editor.openInRightSidebar(uuid)` works. Task 8 code stands as planned.

## (a2) Node-query result shape — RESOLVED ✓ (round 2, verbatim evidence)
Mixed key convention:
- **Built-in attrs → bare keys:** `title`, `uuid` (plus bonus `content`, `full-title`).
- **User-property attrs → FULL ident WITH leading colon as key:** `":user.property/tl-date-yA0s4uuH"`.

Value shapes:
- `tl-topic` (Node, many): **array** of `{ "title": "...", "uuid": "...", "content": "...", "full-title": "..." }` — array even with a single value. Bare keys inside.
- `tl-type` (choice): object `{ "title": "event" }`. Bare key.
- `tl-date` (Text): plain string (post-fix; see hazard below).

**Task 6 impact:**
- Key helper must be three-way: `o[key] ?? o[key.split("/").pop()!] ?? o[":" + key]` — bare-segment fallback hits built-ins (`uuid`, `title`, `ident`), colon fallback hits property idents. Applies to `schema.ts` AND `query.ts`.
- Test fixture must mirror the verbatim shapes above.

## HAZARD (observed live): tl-date created as Date-type property
The user initially created `tl-date` as a **Date** property; values then come back as entity refs — `{"id": 220}` — not strings (Date props store refs to journal pages). First real user hit this within minutes → it WILL happen again.
- **Task 6:** `normalizeRow` must guard: `date: typeof rawDate === "string" ? rawDate : null` (non-string → null → partitioned to needs-attention rather than crashing or garbling).
- **Task 10 (README) + onboarding screen:** state emphatically that `tl-date` must be type **Text**, not Date.

## Cosmetic (accepted for v1)
One BCE label rendered as `0500` instead of `-0500` in the user's post-fix run (vis-timeline BCE-label quirk family, alongside the year-0000 tick). User accepted for v1; candidate for a custom axis `format` later.
