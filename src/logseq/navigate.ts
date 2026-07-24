export function openNode(uuid: string): void {
  logseq.hideMainUI();
  // POC-verified (poc-findings.md §c): pushState with uuid opens both pages and blocks.
  logseq.App.pushState("page", { name: uuid });
}

export function openInSidebar(uuid: string): void {
  // Close the full-screen panel first — otherwise the sidebar opens behind
  // it and is invisible to the user (same pattern as openNode).
  logseq.hideMainUI();
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
