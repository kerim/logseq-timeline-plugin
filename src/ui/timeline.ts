import { renderChronos } from "chronos-timeline-md";

export interface TimelineCallbacks {
  onOpen(uuid: string, inSidebar: boolean): void;
  onHover(uuid: string | null): void;
}

export function buildIdMap(itemIds: unknown[], uuidByIndex: string[]): Map<unknown, string> | null {
  if (itemIds.length !== uuidByIndex.length) return null;
  return new Map(itemIds.map((id, i) => [id, uuidByIndex[i]]));
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

  return { destroy: () => timeline.destroy?.() };
}
