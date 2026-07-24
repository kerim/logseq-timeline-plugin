import type { AttentionEntry } from "../types";
import { openNode } from "../logseq/navigate";

export function renderAttention(host: HTMLElement, entries: AttentionEntry[]): void {
  host.innerHTML = "";
  if (entries.length === 0) return;

  const details = document.createElement("details");
  details.className = "tlp-attention";
  const summary = document.createElement("summary");
  summary.textContent = `⚠ ${entries.length} entr${entries.length === 1 ? "y" : "ies"} need attention`;
  details.append(summary);

  const ul = document.createElement("ul");
  entries.forEach((e, i) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#";
    a.dataset.i = String(i);
    a.textContent = e.node.title || "(untitled)"; // graph content — textContent only
    li.append(a);
    li.append(document.createTextNode(
      e.reason === "missing-date" ? " — no tl-date" : ` — invalid tl-date: "${e.node.date}"`, // graph content — text node only
    ));
    ul.append(li);
  });
  details.append(ul);
  host.append(details);

  host.querySelectorAll<HTMLAnchorElement>("a[data-i]").forEach((a) =>
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      openNode(entries[Number(a.dataset.i)].node.uuid);
    }));
}
