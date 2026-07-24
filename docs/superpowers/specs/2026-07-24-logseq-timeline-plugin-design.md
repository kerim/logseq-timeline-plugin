# Logseq Timeline Plugin — Design Spec

- **Date:** 2026-07-24
- **Status:** Draft, pending user review
- **Target:** Logseq DB graphs only (SQLite-backed, Logseq 0.11+). No markdown-graph support, consistent with the rest of the Logseq tooling umbrella.

## Goal

Render interactive, zoomable historical timelines from nodes in a Logseq DB graph. The user marks any node (block or page) with the `#tl` tag and fills in a date; a toolbar button opens a timeline panel where entries can be filtered by linked topic nodes and by entry type. Clicking a timeline item opens the corresponding Logseq node.

Example entry:

> Mudan Incident `#tl`
> `tl-date`: 1874-05-22
> `tl-topic`: [[Japan]], [[Taiwan]], [[colonialism]], [[indigenous]]
> `tl-type`: event

## Renderer choice (research summary)

Candidates evaluated: Markwhen, Timelines Studio, vis-timeline, TimelineJS3.

| Candidate | Outcome |
|---|---|
| Markwhen timeline view | Rejected for v1: no BCE support (by design, Luxon-bound; issue #166 open), pre-1000 CE quirks, and the timeline repo carries no license file (README declares it open source; a license request upstream would likely fix this, but we won't build on it). Its EDTF-style date syntax influenced `tl-date`. |
| Timelines Studio | Rejected: GPL-3.0 (viral for an MIT plugin), monolithic alpha Electron app, renderer not separable without a fork. Best-in-class deep-time date model, noted for inspiration only. |
| **vis-timeline via `chronos-timeline-md`** | **Chosen.** `chronos-timeline-md` (ISC license, npm) is the extracted rendering core of Obsidian's Chronos plugin (MIT, 367 stars): markdown-in → interactive vis-timeline out, with full event stream (`select`, `click`, `itemover`/`itemout`, `rangechange`…), tooltip callback, CSS-variable theming designed for host-theme sync, BCE via negative years, year/month/day/range precision. vis-timeline itself is Apache-2.0/MIT dual, actively maintained. |
| TimelineJS3 | Rejected: storytelling slideshow, not a zoomable overview. |

Decision (user-approved "Option A"): depend on `chronos-timeline-md` as a library; write only Logseq glue. Fallback if we outgrow it: use vis-timeline directly (same engine underneath; migration is incremental).

## Data model (in the Logseq graph)

One tag, three properties, all defined on the `#tl` tag so they surface automatically on tagging:

| Property | Logseq type | Cardinality | Content |
|---|---|---|---|
| `tl-date` | Text | one | Chronos date syntax: `1874`, `1874-05`, `1874-05-22`, `1895~1945` (range), `-500` (BCE), optional time `1874-05-22T14:30` |
| `tl-topic` | Node | many | References to existing nodes ([[Japan]], [[Taiwan]]…). Topic nodes stay ordinary nodes — no schema imposed on them, deliberately NOT tags/classes. |
| `tl-type` | Choice (text with predefined choices) | one | `event` \| `era` \| `person` (extensible later) |

- The node's **title** is the event label on the timeline.
- All properties are **read** by the plugin; the plugin never mutates user content (see Open Risks for first-run schema setup).
- Naming convention: every plugin-related property is prefixed `tl-`.

### Date semantics

`tl-date` carries the renderer's native syntax, so the plugin does no date parsing of its own. Precision is honest: `1874` spans the year, `1874-05` the month. Ranges use `~` in the same single value. BCE = negative year. Renderer limit: years 271,821 BCE – 275,761 CE (JS Date bounds).

## Architecture

Standard Logseq plugin: TypeScript + Vite + `@logseq/libs` ≥ 0.3.0 (DB-graph API floor). Same stack as `logseq-checklist`.

Components (each independently testable):

1. **Query layer** — one `logseq.DB.datascriptQuery` call fetching all `#tl`-tagged nodes: uuid, title, `tl-date` (string), `tl-topic` (nested pull → titles + uuids), `tl-type` (nested pull → title). Property idents are discovered at runtime by property title (`tl-date` etc.), since user-property idents may be UUID-suffixed. `tl-topic`/`tl-type` are ref-typed; nested pull specs resolve them inline (known pattern, documented in the wiki).
2. **Filter engine (pure TS)** — applies topic selection (AND/OR switch) and type checkboxes in JS. No re-query on filter change.
3. **Transform (pure TS)** — nodes → Chronos markdown lines. `event`/`person` → `- [date] Title`; `era` → `@ [date] Title` when the era-wash toggle is on, else `- [date] Title`. Escapes `|`, `{`, `}`, `#` in titles. Maintains the source-order **index → node-uuid map** for event routing.
4. **Renderer wrapper** — `renderChronos(container, source, options)` from `chronos-timeline-md`; returns `{ timeline, parsed }`, which we use to correlate items with the uuid map and to attach event handlers.
5. **UI shell** — filter bar, canvas, needs-attention list, empty/error states, settings persistence.

### Data flow

Toolbar click → open main UI → query → filter → transform → render → user interacts → events route back to Logseq (open node / sidebar / preview). Refresh button re-runs the pipeline; filter changes re-run from step "filter" only.

## UI

Toolbar button (registered via `registerUIItem`) opens Logseq's full-window plugin overlay:

- **Filter bar:** topic multi-select (choices = distinct nodes referenced by `tl-topic` across all `#tl` entries) · AND/OR switch for topics · type checkboxes (event/era/person) · "eras as background" toggle (default ON) · refresh · close.
- **Canvas:** the chronos-timeline-md timeline (zoom/pan, fit-all button built in).
- **Needs-attention list (collapsible):** `#tl` nodes with missing `tl-date` or a value the renderer rejects; each entry links to its node. Nothing silently disappears.
- **Persistence:** last topic selection, type selection, AND/OR state, and era toggle stored via `logseq.updateSettings`; restored on next open.

Filter semantics: (topics, per AND/OR switch) **AND** (type ∈ checked types). Empty topic selection = all topics; no type checked = all types.

## Interactions

| Gesture | Behavior |
|---|---|
| Click item | Open node in main view (`logseq.App.pushState` / `scrollToBlockInPage` for blocks) |
| Shift-click item | Open node in right sidebar (`logseq.Editor.openInRightSidebar`) |
| Hover item | Tooltip: node title + content snippet fetched live (`getBlock`/`getPage`) |

Routing uses the index→uuid map built in the transform step; shift detection via the original DOM event on the renderer's `click`/`select` events.

## Theming

Light/dark follows Logseq (`getUserConfigs().preferredThemeMode` + `onThemeModeChanged`). The renderer's `--chronos-*` CSS variables are mapped to a palette matching Logseq's default themes.

## Error handling

| Condition | Behavior |
|---|---|
| Markdown (file-based) graph | Clear "DB graphs only" notice; plugin does nothing else |
| `#tl` tag or properties missing | Onboarding screen with setup instructions (or one-click setup if POC clears the namespacing risk) |
| Unparseable / missing `tl-date` | Entry listed in needs-attention with link; timeline still renders the rest |
| No events after filtering | Empty state naming the active filters |
| Query/API failure | Error state with the failing operation and suggestion to retry |

## Testing

- **Unit tests** (pure core, no Logseq needed): transform (type mapping, era toggle, title escaping), filter engine (AND/OR, type combinations), index↔uuid mapping, needs-attention classification.
- **Manual verification:** sample test graph (Mudan Incident 1874; Japanese colonial period 1895~1945 as era; one `person` with lifespan range; BCE entry; a deliberately broken date). Then the standard cycle: implement → self-test → user verifies in their real graph before anything is marked complete.

## Open risks (to resolve in a proof-of-concept before full build)

1. **Schema setup namespacing.** Plugin-created properties get namespaced `:plugin.property.{plugin-id}/*`; the design assumes the user creates `#tl` + properties manually once (30 seconds) so idents live in `:user.property/*`. POC tests whether plugin-driven one-click setup produces clean, user-visible properties; if not, onboarding stays instructions-only.
2. **Item↔node correlation.** Confirm `renderChronos`'s `parsed` output preserves source order / exposes item ids usable for the index→uuid map (README indicates yes).
3. **Property ident discovery.** Confirm title→ident lookup works for choice properties (`tl-type`) whose choice values are themselves entities.
4. **BCE rendering polish.** vis-timeline has a cosmetic "year 0" axis quirk (open upstream bug #581); check how chronos-timeline-md labels BCE axis ticks at the zoom levels typical for this use.

## Out of scope for v1 (recorded decisions, not omissions)

- Colors and swimlane grouping (tags→lanes/colors considered and deferred)
- Saved named timeline presets
- Embedding a timeline inside a page/block
- Markwhen export
- Any write to the graph beyond optional first-run schema setup
- File-based (markdown) graph support — permanent stance, not a deferral

## Versioning

Start at 0.1.0; bump build number on every build; never reuse a version.

## Executive Summary

This plugin turns Logseq notes into interactive historical timelines. You tag a note with `#tl`, give it a date (flexible enough for "1874", exact days, ranges, or BCE years), link it to topic pages like [[Taiwan]] or [[Japan]], and classify it as an event, era, or person. A toolbar button then opens a filterable, zoomable timeline where eras wash across the background and clicking any item jumps to the underlying note. Rather than building a renderer, we rely on the permissively-licensed engine already proven by Obsidian's most popular timeline plugin, so our code is limited to querying Logseq and wiring up the UI. The main risk is small and front-loaded: a quick proof-of-concept must confirm that reading (and optionally auto-creating) the property schema behaves cleanly under Logseq's plugin property rules before we commit to the full build.
