import type { Filters, TimelineNode, TlType } from "../types";

export function renderFilterBar(
  host: HTMLElement,
  nodes: TimelineNode[],
  filters: Filters,
  onChange: (f: Filters) => void,
  onRefresh: () => void,
): void {
  const topicTitles = [...new Set(nodes.flatMap((n) => n.topics.map((t) => t.title)))].sort();
  const types: TlType[] = ["event", "era", "person"];

  // Static chrome only — no graph content here. Topic titles are user/graph
  // content and are appended below via textContent, never interpolated
  // into an HTML string.
  host.innerHTML = `
    <details class="tlp-topics"><summary>Topics${filters.topics.length ? ` (${filters.topics.length})` : ""}</summary>
      <div class="tlp-topic-list"></div>
    </details>
    <button id="tlp-mode" title="Topic combine mode">${filters.topicMode}</button>
    <span class="tlp-types"></span>
    <label class="tlp-era"><input type="checkbox" id="tlp-erawash"
      ${filters.erasAsBackground ? "checked" : ""}/> eras as background</label>
    <button id="tlp-refresh" title="Re-query the graph">↻</button>`;

  const topicList = host.querySelector<HTMLElement>(".tlp-topic-list")!;
  for (const title of topicTitles) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.topic = title;
    input.checked = filters.topics.includes(title);
    label.append(input, document.createTextNode(" " + title));
    topicList.append(label);
  }

  const typesSpan = host.querySelector<HTMLElement>(".tlp-types")!;
  for (const t of types) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.type = t;
    input.checked = filters.types.includes(t);
    label.append(input, document.createTextNode(" " + t));
    typesSpan.append(label);
  }

  const emit = () => {
    const topics = [...host.querySelectorAll<HTMLInputElement>("[data-topic]:checked")].map((i) => i.dataset.topic!);
    const typesChecked = [...host.querySelectorAll<HTMLInputElement>("[data-type]:checked")].map((i) => i.dataset.type!);
    const mode = (host.querySelector("#tlp-mode") as HTMLButtonElement).textContent as "AND" | "OR";
    const era = (host.querySelector("#tlp-erawash") as HTMLInputElement).checked;
    onChange({ topics, topicMode: mode, types: typesChecked, erasAsBackground: era });
  };
  host.querySelectorAll("input").forEach((i) => i.addEventListener("change", emit));
  host.querySelector("#tlp-mode")!.addEventListener("click", (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    b.textContent = b.textContent === "OR" ? "AND" : "OR";
    emit();
  });
  host.querySelector("#tlp-refresh")!.addEventListener("click", onRefresh);
}
