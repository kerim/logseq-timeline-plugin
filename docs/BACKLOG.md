# Post-0.1.1 backlog

Deferred items from the v0.1.0/0.1.1 reviews, none blocking daily use. Sources: final whole-branch review + per-task reviews (`.superpowers/sdd/`).

## Before any marketplace submission
- `package.json`: add `license`, `author`, `repository` fields.
- README screenshot (`<!-- TODO: screenshot -->`).

## Cosmetics / features considered and deferred
- Dark-mode canvas: chronos ignores our theme variable mapping; canvas stays light (documented in README).
- `[[wikilinks]]` in titles get chronos link styling on the canvas.
- Tags → colors / swimlane grouping (deliberately out of v1; spec records the decision).
- Saved named timeline presets; in-page timeline embedding.
- `tl-type` dropdown preset: blocked by upstream bug — report at `docs/logseq-bug-report.md`, file to https://github.com/logseq/db-test/issues/new. Revisit `setup.ts` when fixed upstream.
