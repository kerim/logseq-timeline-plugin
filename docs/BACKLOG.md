# Post-0.1.1 backlog

Deferred items from the v0.1.0/0.1.1 reviews, none blocking daily use. Sources: final whole-branch review + per-task reviews (`.superpowers/sdd/`).

## Before any marketplace submission
- `package.json`: add `license`, `author`, `repository` fields.
- README screenshot (`<!-- TODO: screenshot -->`).

## Robustness polish
- Date validation upgrade in `validate.ts`: month ≤ 12, day ≤ 31, start ≤ end for ranges — moves typos into needs-attention instead of the renderer-error message.
- Hover tooltip race: async preview can re-show after pointer leaves (`app.ts` onHover); fix with a hover sequence counter.
- `initApp` re-entrancy guard (epoch counter) against rapid refresh clicks.
- Dedupe filter defaults: `DEFAULT_FILTERS` (constants.ts) vs. `sanitizeFilters` (filter.ts) are two sources of truth.
- Renderer error message counts the hidden `> NOTODAY` line — "Line N" is off by one vs. visible entries.

## Cosmetics / features considered and deferred
- Dark-mode canvas: chronos ignores our theme variable mapping; canvas stays light (documented in README).
- BCE axis labels sometimes drop the minus sign (renderer quirk).
- `[[wikilinks]]` in titles get chronos link styling on the canvas.
- Tags → colors / swimlane grouping (deliberately out of v1; spec records the decision).
- Saved named timeline presets; in-page timeline embedding.
- `tl-type` dropdown preset: blocked by upstream bug — report at `docs/logseq-bug-report.md`, file to https://github.com/logseq/db-test/issues/new. Revisit `setup.ts` when fixed upstream.
- Whisker label layout does up to 5 reflows per whisker per redraw — batch if graphs reach thousands of ranges.
- Dead CSS: `#tlp-body` rule in styles.css.
- Filter tests: empty-topics node under topic filter; multi-value type filter.
