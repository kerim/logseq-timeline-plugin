# Logseq Timeline Plugin

Turn `#tl`-tagged nodes in your Logseq graph into an interactive, zoomable historical timeline. Tag any block or page, give it a date, link it to topics, and it shows up on a timeline you can filter, pan, and zoom — click an item to jump straight back to the node it came from.

![The timeline panel showing eleventh- to thirteenth-century entries: the Middle Ages, Islamic Golden Age, Song dynasty and Mongol Empire as background washes with their labels stacked in separate lanes, Genghis Khan's lifespan as a whisker, and the Battle of Hastings and the sealing of Magna Carta as point events.](./docs/screenshot.png)

## DB graphs only

This plugin works **only on Logseq DB graphs** (the SQLite-backed database graphs, Logseq 0.11+). It does not support old-style file/markdown graphs, and has no plans to.

## Try it with the demo graph

If you'd rather see the plugin working before setting anything up, this repo ships a ready-made graph: [`demo/timeline-demo.sqlite`](./demo/timeline-demo.sqlite).

1. Download the file.
2. In Logseq, open the three-dots menu (top right) → **Import** → **Import using the SQLite DB file from export**, and choose it.
3. Install the plugin, then open the timeline panel.

It contains 60 world-history entries — 20 eras, 15 people and 25 events, spanning the Bronze Age to the fall of the Berlin Wall — tagged across six topics (Europe, East Asia, Americas, Science, Religion, Warfare). Between them they exercise every `tl-date` form the plugin accepts, plus overlapping eras, dense clusters of events, and entries stored both as pages and as blocks. Dates come from Wikidata (CC0).

## Setup

The plugin reads three tag properties off a `#tl` tag: `tl-date`, `tl-topic`, `tl-type`. There are two ways to create them.

### Option A — one click

Open the timeline panel (toolbar button, see below) on a graph that doesn't have the schema yet, and press **"Create the schema for me"**. This creates the `tl` tag and all three properties in one step.

### Option B — manual (~1 minute)

1. Create a tag named `tl` (type `#tl` in any block).
2. On the `tl` tag page, add three tag properties:
   - `tl-date` — type **Text**. **Not Date** — a Date-type property stores a reference to a journal page, not a value the plugin can parse.
   - `tl-topic` — type **Node**, with **multiple values** enabled.
   - `tl-type` — type **Text**.
3. Tag a node with `#tl`, fill in `tl-date`, and open the timeline panel.

### Optional: a dropdown for `tl-type`

Plugins cannot predefine dropdown choices on a Logseq property — this is an upstream limitation (see [`./docs/logseq-bug-report.md`](./docs/logseq-bug-report.md), filed against `logseq/db-test`). If you'd like `event` / `era` / `person` to appear as a dropdown instead of free text, open `tl-type`'s property settings and add those three choices yourself — once per graph, about 30 seconds. Values typed in without the dropdown work identically either way, and capitalisation doesn't matter: `Era`, `era` and `ERA` are all read the same way (Logseq's property editor title-cases choices as you add them).

## Usage

Tag any node `#tl` and fill in its properties:

- **`tl-date`** — when it happened. See the syntax table below.
- **`tl-topic`** — link to one or more existing topic pages (e.g. `[[Japan]]`, `[[Taiwan]]`). These stay ordinary nodes; the plugin imposes no schema on them.
- **`tl-type`** — `event`, `era`, or `person`.

The node's own title becomes its label on the timeline.

### `tl-date` syntax

| Example | Meaning |
|---|---|
| `1874` | The year 1874 |
| `1874-05` | May 1874 |
| `1874-05-22` | 22 May 1874 |
| `1895~1945` | A range, from 1895 to 1945 — use `~`, **not a hyphen** |
| `-500` | 500 BCE (negative year) |
| `1874-05-22T14:30` | Any of the above with an optional time |

Supported range: 271,821 BCE to 275,761 CE (the underlying renderer's date bounds).

## The panel

A toolbar button (in Logseq's own toolbar) opens the timeline panel, which sits just below Logseq's toolbar strip.

- **Topics** — multi-select of every topic referenced by any `#tl` node, with a switch between **AND** (must match all selected topics) and **OR** (any of them). No topics selected = all topics shown.
- **Types** — checkboxes for `event` / `era` / `person`. None checked = all types shown.
- **Eras as background** — toggle. When on, an `era`-typed node with a date range washes across the timeline background instead of rendering as its own bar.
- **Refresh** — re-runs the query against the graph.
- Your filter selections (topics, mode, types, era toggle) persist across sessions.

## Reading the timeline

Point-in-time entries render as points; date ranges render as bars. If a range bar is wide enough for its label to fit, the label sits inside the bar. If it's too narrow, the item switches to a `|——|` "whisker" — a thin span indicator with the label floated beside it — and label placement automatically avoids overlapping nearby items. Zooming (cmd/ctrl+scroll) changes bar widths, so items flip between the bar and whisker rendering as needed.

## Interactions

| Action | Result |
|---|---|
| Click an item | Opens the underlying node; the panel closes |
| Shift-click an item | Opens the node in the right sidebar; the panel closes |
| Hover an item | Shows a content preview |

## Entries needing attention

Any `#tl` node with a missing or unparseable `tl-date` is listed above the canvas, with a link to the node — it's never silently dropped from view.

## Known limitations

- The timeline canvas always renders with a light background, even when Logseq is in dark mode — a known gap in the bundled renderer's theming. Text color is adapted for readability, but the canvas fill itself does not yet follow the app theme.
- BCE axis labels can render without their minus sign at some zoom levels (a cosmetic quirk in the underlying renderer).
- `tl-type` dropdown choices can't be preset by the plugin — see [Setup](#optional-a-dropdown-for-tl-type) above and the filed bug report.
- Dates are limited to 271,821 BCE to 275,761 CE (the renderer's underlying date bounds).

## Development

```bash
pnpm install
pnpm build
pnpm test
```

### Debug harness

To iterate on the UI without a running Logseq instance, there's a harness that mocks the `logseq` plugin API and opens the panel with sample data in any browser:

```bash
pnpm vite build --config harness.vite.config.ts
```

Then serve `dist-harness/` with any static file server and open it in a browser.

## Credits & licenses

This plugin (MIT) is built on:

- [`chronos-timeline-md`](https://www.npmjs.com/package/chronos-timeline-md) (ISC) — the extracted rendering core of [Chronos Timeline](https://github.com/clairefro/obsidian-plugin-chronos), an Obsidian plugin by Claire Froelich (MIT).
- [`vis-timeline`](https://github.com/visjs/vis-timeline) (Apache-2.0 / MIT dual-licensed).

The `tl-date` syntax was influenced by [Markwhen](https://markwhen.com/)'s date syntax.

## License

MIT — see [`LICENSE`](./LICENSE).
