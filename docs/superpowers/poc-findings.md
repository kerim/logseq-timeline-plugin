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
- `tl-date` (Text/`:default`): **ref to a value entity** — `{"id": N}` under a plain pull. CLI-verified against the live graph: the property's `:db/valueType` is `db.type/ref` with `:logseq.property/type` `default` — in DB graphs, even Text values live on hidden value-entities whose `:block/title` holds the text (`"1874-05-22"`, `"1895~1945"`, `"-500"`). **Task 6 must pull `tl-date` NESTED** — `{ident [:block/title]}` — and read the title, same as tl-topic/tl-type.

**Task 6 impact:**
- Key helper must be three-way: `o[key] ?? o[key.split("/").pop()!] ?? o[":" + key]` — bare-segment fallback hits built-ins (`uuid`, `title`, `ident`), colon fallback hits property idents. Applies to `schema.ts` AND `query.ts`.
- Test fixture must mirror the verbatim shapes above.

## CORRECTION (2026-07-24, CLI-verified): the `{"id": 220}` ref was NOT a Date-type artifact
Earlier drafts of these findings blamed the ref-shaped `tl-date` value on the property having been created as Date-type. Wrong: the user's screenshot showed the property is Text, and direct CLI queries confirmed Text (`:default`) properties are `db.type/ref` too. The refs are normal. Design consequences:
- **Task 6:** pull `tl-date` nested (`{ident [:block/title]}`); extraction must tolerate three shapes: string (defensive, if some type is scalar), object-with-title (normal), anything else → `null` → needs-attention.
- **Date-type mistake is still worth guarding:** a Date-typed `tl-date` refs a journal page, so the nested pull yields a title like `"May 22nd, 1874"` — which fails `TL_DATE_RE` and lands in needs-attention with the value visible. Graceful, no crash. README/onboarding still say: type **Text**.

## Cosmetic (accepted for v1)
One BCE label rendered as `0500` instead of `-0500` in the user's post-fix run (vis-timeline BCE-label quirk family, alongside the year-0000 tick). User accepted for v1; candidate for a custom axis `format` later.
