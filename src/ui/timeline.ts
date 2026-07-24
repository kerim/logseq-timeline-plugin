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
function staggerWhiskerLabels(container: HTMLElement): void {
  const whiskers = [...container.querySelectorAll<HTMLElement>(".vis-item.vis-range.tlp-whisker")]
    .map((item) => ({ item, content: item.querySelector<HTMLElement>(".vis-item-content") }))
    .filter((w): w is { item: HTMLElement; content: HTMLElement } => w.content !== null)
    .sort((a, b) => a.item.getBoundingClientRect().left - b.item.getBoundingClientRect().left);
  // Obstacles a label must dodge: box/point items (laid out by vis, can't
  // move) and every whisker bracket. Whisker labels themselves are added as
  // they are placed, left to right.
  const placed: DOMRect[] = [
    ...container.querySelectorAll(".vis-item.vis-box, .vis-item.vis-point"),
    ...whiskers.map((w) => w.item),
  ].map((el) => el.getBoundingClientRect());
  const overlapArea = (a: DOMRect, b: DOMRect) =>
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const totalOverlap = (r: DOMRect) => placed.reduce((sum, p) => sum + overlapArea(p, r), 0);
  // Candidate slots per label: above the bracket, below it, then further
  // out in whole label-heights. First collision-free slot wins; if none is
  // free, least total overlap wins.
  const LABEL_H = 15;
  const SLOTS: Array<{ below: boolean; shift: number }> = [
    { below: false, shift: 0 },
    { below: true, shift: 0 },
    { below: true, shift: LABEL_H },
    { below: false, shift: -LABEL_H },
    { below: true, shift: 2 * LABEL_H },
  ];
  for (const { item, content } of whiskers) {
    let best: { rect: DOMRect; below: boolean; shift: number; overlap: number } | null = null;
    for (const slot of SLOTS) {
      item.classList.toggle("tlp-whisker-below", slot.below);
      content.style.setProperty("--tlp-label-shift", `${slot.shift}px`);
      const rect = content.getBoundingClientRect();
      const overlap = totalOverlap(rect);
      if (best === null || overlap < best.overlap) best = { rect, below: slot.below, shift: slot.shift, overlap };
      if (overlap === 0) break;
    }
    item.classList.toggle("tlp-whisker-below", best!.below);
    content.style.setProperty("--tlp-label-shift", `${best!.shift}px`);
    placed.push(best!.rect);
  }
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

  timeline.on("changed", () => updateWhiskerClasses(container));
  updateWhiskerClasses(container); // initial pass — `changed` may not have fired before first paint

  return { destroy: () => timeline.destroy?.() };
}
