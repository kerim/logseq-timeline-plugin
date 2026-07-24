import { renderChronos } from "chronos-timeline-md";

export async function runProbe(out: HTMLElement) {
  const log = (label: string, v: unknown) => {
    const h = document.createElement("h4");
    h.textContent = label;
    const pre = document.createElement("pre");
    pre.textContent = typeof v === "string" ? v : JSON.stringify(v, null, 2);
    out.append(h, pre);
    console.log("[tlp-poc]", label, v);
  };

  // (e) DB-graph detection
  try {
    log("checkCurrentIsDbGraph", await logseq.App.checkCurrentIsDbGraph());
  } catch (e) { log("checkCurrentIsDbGraph FAILED", String(e)); }

  // (a) ident discovery — exact key shape matters
  try {
    const props = await logseq.DB.datascriptQuery(`
      [:find (pull ?p [:db/ident :block/title])
       :where [?p :db/ident ?i] [(namespace ?i) ?ns] [(= ?ns "user.property")]]`);
    log("user.property idents (raw)", props);

    const flat: Array<Record<string, unknown>> = (props ?? []).map((r: unknown[]) => r[0] as Record<string, unknown>);
    const identOf = (title: string) =>
      flat.find((p) => p["block/title"] === title || p[":block/title"] === title);
    const d = identOf("tl-date"), t = identOf("tl-topic"), ty = identOf("tl-type");
    log("resolved idents", { d, t, ty });

    // (a) full node query with nested pulls
    if (d && t && ty) {
      try {
        const ident = (p: Record<string, unknown>) => String(p["db/ident"] ?? p[":db/ident"]);
        const q = `[:find (pull ?b [:block/uuid :block/title
            ${ident(d)}
            {${ident(t)} [:block/title :block/uuid]}
            {${ident(ty)} [:block/title]}])
          :where [?b :block/tags ?tag] [?tag :block/title "tl"]]`;
        log("node query", q);
        log("node query result (raw)", await logseq.DB.datascriptQuery(q));
      } catch (e) { log("node query FAILED", String(e)); }
    }
  } catch (e) { log("ident discovery FAILED", String(e)); }

  // (b)+(d) renderer probe: order, ids, BCE axis
  try {
    const container = document.createElement("div");
    container.style.height = "300px";
    out.appendChild(container);
    const src = ["> NOTODAY", "- [-500] BCE event", "@ [1895~1945] Era wash", "- [1874-05-22] Mudan Incident"].join("\n");
    const { parsed } = renderChronos(container, src, {});
    log("parsed (order + ids?)", parsed);
  } catch (e) { log("renderChronos FAILED", String(e)); }

  // (c) navigation probes — buttons so user can eyeball each behavior
  try {
    const rows = (await logseq.DB.datascriptQuery(
      `[:find (pull ?b [:block/uuid :block/title])
        :where [?b :block/tags ?tag] [?tag :block/title "tl"]]`)) ?? [];
    for (const [node] of rows as Array<[Record<string, string>]>) {
      const uuid = node["block/uuid"] ?? node[":block/uuid"];
      const title = node["block/title"] ?? node[":block/title"];
      const btn = document.createElement("button");
      btn.textContent = `pushState → ${title}`;
      btn.onclick = () => { logseq.hideMainUI(); logseq.App.pushState("page", { name: String(uuid) }); };
      const btn2 = document.createElement("button");
      btn2.textContent = `sidebar → ${title}`;
      btn2.onclick = () => logseq.Editor.openInRightSidebar(String(uuid));
      out.append(btn, btn2, document.createElement("br"));
    }
  } catch (e) { log("navigation buttons FAILED", String(e)); }
}
