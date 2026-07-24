import { renderChronos } from "chronos-timeline-md";

export interface TimelineCallbacks {
  onOpen(uuid: string, inSidebar: boolean): void;
  onHover(uuid: string | null): void;
}

export function buildIdMap(itemIds: unknown[], uuidByIndex: string[]): Map<unknown, string> | null {
  if (itemIds.length !== uuidByIndex.length) return null;
  return new Map(itemIds.map((id, i) => [id, uuidByIndex[i]]));
}

// A range item's label clips to the bar's pixel width (vis-timeline's
// `.vis-item-overflow` is `overflow: hidden`). When the label doesn't fit,
// switch that item to a "whisker" rendering (see styles.css `.tlp-whisker`):
// a thin span indicator with the label floated above, unclipped. Re-measured
// on every timeline `changed` event, since a bar's pixel width changes with
// zoom/pan. Scoped to `.vis-item.vis-range` only — era washes
// (`.vis-background`) and point/box items are untouched.
const WHISKER_TOLERANCE_PX = 4;

function updateWhiskerClasses(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>(".vis-item.vis-range").forEach((item) => {
    const content = item.querySelector<HTMLElement>(".vis-item-content");
    if (!content) return;
    const shouldWhisker = content.scrollWidth > item.clientWidth + WHISKER_TOLERANCE_PX;
    if (item.classList.contains("tlp-whisker") === shouldWhisker) return; // unchanged — avoid a DOM write / event-storm churn
    if (shouldWhisker && !item.style.getPropertyValue("--tlp-whisker-color")) {
      // Capture the bar's current fill/border color *before* toggling the
      // class — `.tlp-whisker` makes the background transparent, so this
      // must run first — so the whisker caps/line match whatever accent
      // the item currently renders with. Cached once per DOM element via
      // the inline custom property; later passes reuse it.
      const cs = getComputedStyle(item);
      const accent = cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent"
        ? cs.backgroundColor
        : cs.borderColor;
      item.style.setProperty("--tlp-whisker-color", accent);
    }
    item.classList.toggle("tlp-whisker", shouldWhisker);
  });
  staggerWhiskerLabels(container);
}

// Whisker labels float outside the item boxes vis-timeline uses for its
// stacking layout, so two nearby whiskers can print their labels on top of
// each other. After every re-measure, walk the whiskers left-to-right and
// drop any label that would overlap an already-placed one to *below* its
// bracket instead (see `.tlp-whisker-below` in styles.css). Two levels
// resolve the common pairwise clash; dense pile-ups may still overlap and
// resolve on zoom-in.
//
// Candidate slots are computed arithmetically from a single measurement
// (the label's natural "above, shift 0" rect plus its bracket rect) rather
// than by writing each candidate class/style to the DOM and re-measuring —
// that used to cost up to 5 interleaved measure/write (reflow) cycles per
// label per redraw. One measure pass + one write pass per label now.
interface Rect { left: number; right: number; top: number; bottom: number; }

function toRect(r: DOMRect): Rect {
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}

function translateRect(r: Rect, dy: number): Rect {
  return { left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy };
}

function overlapArea(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

const LABEL_H = 15;

function staggerWhiskerLabels(container: HTMLElement): void {
  const whiskers = [...container.querySelectorAll<HTMLElement>(".vis-item.vis-range.tlp-whisker")]
    .map((item) => ({ item, content: item.querySelector<HTMLElement>(".vis-item-content") }))
    .filter((w): w is { item: HTMLElement; content: HTMLElement } => w.content !== null);
  if (whiskers.length === 0) return;

  // Reset every whisker to its baseline (above the bracket, shift 0)
  // position first — a single batch of writes — so the measurement pass
  // below reads a consistent layout in one reflow instead of interleaving
  // per-candidate writes and reads.
  for (const { item, content } of whiskers) {
    item.classList.remove("tlp-whisker-below");
    content.style.setProperty("--tlp-label-shift", "0px");
  }

  // Single measure pass: the label's natural (above, shift-0) rect plus its
  // bracket's rect. Every other candidate slot below is derived from these
  // two by pure arithmetic — no further DOM reads.
  const measured = whiskers
    .map(({ item, content }) => ({
      item,
      content,
      rect0: toRect(content.getBoundingClientRect()),
      bracketRect: toRect(item.getBoundingClientRect()),
    }))
    .sort((a, b) => a.bracketRect.left - b.bracketRect.left);

  // Obstacles a label must dodge: box/point items (laid out by vis, can't
  // move) and every whisker bracket. Whisker labels themselves are added as
  // they are placed, left to right.
  const placed: Rect[] = [
    ...[...container.querySelectorAll(".vis-item.vis-box, .vis-item.vis-point, .vis-item.vis-range:not(.tlp-whisker)")]
      .map((el) => toRect(el.getBoundingClientRect())),
    ...measured.map((w) => w.bracketRect),
  ];
  const totalOverlap = (r: Rect) => placed.reduce((sum, p) => sum + overlapArea(p, r), 0);

  for (const { item, content, rect0, bracketRect } of measured) {
    // Candidate slots per label: above the bracket, below it, then further
    // out in whole label-heights — same semantics as before, but each rect
    // is now computed by translating rect0 rather than measured live.
    const belowDy = (bracketRect.bottom - bracketRect.top) + (rect0.bottom - rect0.top);
    const candidates: Array<{ below: boolean; shift: number; rect: Rect }> = [
      { below: false, shift: 0, rect: rect0 },
      { below: true, shift: 0, rect: translateRect(rect0, belowDy) },
      { below: true, shift: LABEL_H, rect: translateRect(rect0, belowDy + LABEL_H) },
      { below: false, shift: -LABEL_H, rect: translateRect(rect0, -LABEL_H) },
      { below: true, shift: 2 * LABEL_H, rect: translateRect(rect0, belowDy + 2 * LABEL_H) },
    ];
    // First collision-free slot wins; if none is free, least total overlap
    // wins.
    let best: { rect: Rect; below: boolean; shift: number; overlap: number } | null = null;
    for (const c of candidates) {
      const overlap = totalOverlap(c.rect);
      if (best === null || overlap < best.overlap) best = { ...c, overlap };
      if (overlap === 0) break;
    }
    item.classList.toggle("tlp-whisker-below", best!.below);
    content.style.setProperty("--tlp-label-shift", `${best!.shift}px`);
    placed.push(best!.rect);
  }
}

// vis-timeline's default axis formatter drops the minus sign on BCE year
// labels (e.g. "-500" renders as "500"), so a mixed-era view can't be told
// apart from a CE one by reading the text alone. Only run when the visible
// window actually reaches into BCE (start year < 1) — a guard that exits
// immediately for CE-only views (the overwhelming majority).
//
// Detecting *which* labels are BCE avoids pixel math: read the year labels
// in left-to-right (DOM) order by `offsetLeft`, parse their (unsigned)
// numeric value. With the window start < 1, those values descend while
// still BCE (further from zero = larger magnitude), then ascend once the
// axis crosses into CE — a "valley" shape. Every label strictly before that
// minimum-value turning point is BCE; the turning point itself and
// everything after is CE (or exactly "0000", which is left unprefixed
// either way). If the window's end year is also < 1, the whole visible
// range is BCE and every label gets prefixed.
function fixBceAxisLabels(container: HTMLElement, chronosTimeline: { timeline?: { getWindow(): { start: Date; end: Date } } }): void {
  const win = chronosTimeline.timeline?.getWindow();
  if (!win || win.start.getFullYear() >= 1) return; // no vis-timeline instance, or a CE-only view

  const labels = [...container.querySelectorAll<HTMLElement>(".vis-time-axis .vis-text")]
    .filter((el) => /^\d{3,6}$/.test(el.textContent?.trim() ?? ""));
  if (labels.length === 0) return;

  const prefix = (el: HTMLElement) => {
    const text = el.textContent!.trim();
    if (text !== "0000" && !text.startsWith("-")) el.textContent = `-${text}`;
  };

  if (win.end.getFullYear() < 1) {
    labels.forEach(prefix); // whole visible range is BCE
    return;
  }

  const ordered = [...labels].sort((a, b) => a.offsetLeft - b.offsetLeft);
  const values = ordered.map((el) => Number(el.textContent!.trim()));
  let minIndex = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[minIndex]) minIndex = i;
  }
  for (let i = 0; i < minIndex; i++) prefix(ordered[i]);
}

export function mountTimeline(
  container: HTMLElement,
  build: { source: string; uuidByIndex: string[] },
  cb: TimelineCallbacks,
): { destroy(): void } | { error: string } {
  const { timeline, parsed } = renderChronos(container, build.source, { settings: { align: "center" } });
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

  const onChanged = () => {
    updateWhiskerClasses(container);
    fixBceAxisLabels(container, timeline);
  };
  timeline.on("changed", onChanged);
  onChanged(); // initial pass — `changed` may not have fired before first paint

  return { destroy: () => timeline.destroy?.() };
}
