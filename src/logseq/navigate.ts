export function openNode(uuid: string): void {
  logseq.hideMainUI();
  // POC-verified (poc-findings.md §c): pushState with uuid opens both pages and blocks.
  logseq.App.pushState("page", { name: uuid });
}

export function openInSidebar(uuid: string): void {
  logseq.Editor.openInRightSidebar(uuid);
}

export async function getPreviewText(uuid: string): Promise<string> {
  try {
    const block = await logseq.Editor.getBlock(uuid, { includeChildren: true });
    if (!block) return "";
    const first = (block.children?.[0] as { content?: string } | undefined)?.content ?? "";
    return first.slice(0, 240);
  } catch {
    return "";
  }
}
