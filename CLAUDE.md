# logseq-history-timeline-plugin — project instructions

Logseq DB-graph plugin rendering historical timelines from `#tl`-tagged nodes. TypeScript + Vite + `@logseq/libs` + `chronos-timeline-md`. Wiki page: `projects/logseq-timeline-plugin` (has a concepts page and the task list — wiki dir keeps the old name). Public repo: <https://github.com/kerim/logseq-history-timeline-plugin> (renamed from `logseq-timeline-plugin` 2026-07-25; GitHub redirects the old URL. Local working dir still uses the old name). Marketplace title: "History Timeline". (HTTPS origin; push after each landed change). Note: the GitHub MCP token cannot create repos, and cannot open a PR against a third-party repo (both 403 "Resource not accessible by personal access token") — repo creation/admin and cross-fork PRs go through `gh`, per the global rule. Creating a branch and pushing files to *your own* fork via the MCP works fine; only the final `create_pull_request` needs `gh`.

## Skills to load at session start

`logseq-cli`, `logseq-db-knowledge`, `logseq-schema`. (Spellbook currently ships only `logseq-cli`; the other two are personal skills. The wiki's claim that spellbook hosts `logseq-db-plugin-api` is stale.)

## Commands & tooling

- `pnpm test` (vitest, 55 tests on the pure core) · `pnpm build` (tsc strict + vite → `dist/`) · `pnpm dev` (watch).
- `pnpm install` requires `dangerouslyDisableSandbox: true` (global rule).
- **git operations in this repo need `dangerouslyDisableSandbox: true`** — the sandbox allowlist has the lowercase `Code/logseq/…` path; the repo lives under capital-L `Code/Logseq/…`. Recurring; user knows.
- **Logseq CLI** (`logseq query/graph/upsert … --graph "<name>" --output json`) is the verification loop for anything DB-side — always verify claims about stored data with it. Queries need `dangerouslyDisableSandbox: true` (the CLI's db-worker daemon binds localhost, which the sandbox blocks; `sandbox.network.allowLocalBinding` would be the permanent fix).
- Test graph with real schema + sample entries: `timeline-test`. Graphs created via `logseq graph create` do NOT appear in a running desktop app — relaunch required.
- Plugin install for testing: Logseq → Developer mode → Load unpacked plugin → this folder. After every build the user must Reload the plugin (⋯ → Plugins → Timeline → Reload) — batch changes to minimize their reload rounds.

## Debug harness (use it before bothering the user)

`harness.html` + `src/harness.ts` (mocked `logseq` global with fixture nodes) render the full panel in a plain browser:

```
pnpm vite build --config harness.vite.config.ts
python3 -m http.server 8931 -d dist-harness   # unsandboxed (localhost bind)
```

Then drive `http://localhost:8931/harness.html` with the Claude-in-Chrome tools. Rules learned:
- Reproduce and SEE every visual/DOM change here before asking the user to reload-and-test. User round-trips are the scarcest resource in this project.
- Screenshot pixels ≠ CSS pixels — compute `scale = screenshotWidth / window.innerWidth` before converting element rects to click coordinates.
- If the bug does not reproduce in the harness, it's the Logseq embedding (see drag-strip note below) — inspect the real environment's DOM from the top frame, e.g. via test.logseq.com in Chrome (same frontend code; no window-drag regions there).
- The mock's `datascriptQuery` dispatches on query-text substrings — keep the discovery-query branch (`namespace`) ahead of the node-query branch (`:block/tags`); the node query text also contains `user.property`.

## Hard-won facts — do not relearn these

- **Electron drag strip:** desktop Logseq's top ~48px is `-webkit-app-region: drag`; it eats clicks over plugin overlays at ANY z-index (9999 changes nothing; the ✕ only worked because it sat under a no-drag button island). That's why `main.ts` sets `top: "48px"`. Web Logseq has no drag regions — that's the discriminating test.
- **Text (`:default`) properties are ref-typed.** The value is `{id: N}` pointing at a hidden entity whose `:block/title` holds the text. ALL THREE tl-properties need nested pulls. (The wiki's type table was wrong; corrected 2026-07-24.)
- **`datascriptQuery` JSON key shapes are mixed:** built-in attrs → bare keys (`title`, `uuid`, `ident`); user-property attrs → full colon-prefixed ident (`":user.property/tl-date-xxx"`). Idents are UUID-suffixed → discovery is by `:block/title`, and the three-way `k()` helper in `schema.ts`/`query.ts` handles all shapes. The CLI's JSON uses yet another shape (`"block/title"`) — don't conflate.
- **Plugin-created properties** land in `plugin.property.<plugin-id>/*` but are schema-identical to user-created ones; discovery accepts both namespaces. Note the id changed at v0.1.7 (`logseq-timeline-plugin` → `logseq-history-timeline-plugin`), so `demo/timeline-demo.sqlite` carries the OLD namespace — harmless, because `schema.ts` discovers by `:block/title` across any `plugin.property*` namespace, and `query.ts` finds the tag by title too.
- **`addPropertyValueChoices` is unusable from any plugin** (worker-side `(assert (every? uuid? …))`; errors swallowed — promise resolves, nothing happens). Proven against Logseq source + two live rounds. Bug report: `docs/logseq-bug-report.md` → logseq/db-test (filed). Do not re-attempt until upstream fixes; then revisit `setup.ts`.
- **vis-timeline overwrites inline `transform` on `.vis-item-content` every redraw** — position labels via inset offsets (`top`/`bottom`), never transforms.
- **Chronos-markdown:** `@` era washes require ranges (single-date eras fall back to `-`); the parser THROWS on semantically-bad dates (reversed range, month 13) — `validate.ts` pre-validates and `app.ts` catches; the generated `> NOTODAY` first line makes chronos "Line N" off-by-one (the catch rewrites it to "entry N").
- **`tl-date` must be Text, not Date** (Date-typed values ref journal pages; they surface in needs-attention as unparseable titles). Property type is immutable after creation in the UI.

## Process rules from this project's mistakes (the user WILL call these out)

1. **Never assert what you haven't verified.** Every unverified claim made here was wrong at least once: "the timeline repo is unlicensed" (README declared intent), "vis-timeline looks utilitarian" (screenshots said otherwise), "Text properties come back as strings" (refs), "choices are impossible" (declared before actually trying), "you accepted the BCE quirk" ("fine for now" ≠ accepted). Verify against source code, the live DB (CLI), or the harness first.
2. **Research the named tools before designing around them.** The user's first correction of the day: look at Markwhen/Timelines Studio before asking schema questions.
3. **Plain English with this user.** No jargon walls; when a message runs long, lead with the one-sentence version. If they say "huh?", the failure was the register, not their reading.
4. **Repeat instructions in full when asking them to act** — never "see three messages back". They will not scroll.
5. **Report contents, not filenames.** Creating a file (backlog, report) without saying what's in it reads as hiding the ball.
6. **A task isn't finished until their stated goal is met** — don't pivot to wrap-up with an acceptance item still open; they notice.
7. **Fix defects when found.** "Documented in the backlog" was not an acceptable resting state for known bugs in a shipping project.
8. **Search for existing issues before drafting bug reports** — and Logseq DB bugs go to `logseq/db-test`, not `logseq/logseq`. (The GitHub MCP issue-search returned false zeros on db-test; use the REST search API via curl to verify.)
9. **Versions: bump on every change, never reuse** (already a global rule; enforced per-commit here — history went 0.0.1→0.1.2 with no reuse).
10. **Popup questions only for trivially simple choices; trade-offs go in prose, then stop and wait.**
