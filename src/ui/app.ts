import { SETTINGS_KEY } from "../constants";
import { applyFilters, sanitizeFilters } from "../core/filter";
import { buildChronosSource } from "../core/transform";
import { partitionNodes } from "../core/validate";
import { getPreviewText, openInSidebar, openNode } from "../logseq/navigate";
import { fetchTimelineNodes } from "../logseq/query";
import { discoverSchema } from "../logseq/schema";
import { setupSchema } from "../logseq/setup";
import type { Filters, TimelineNode } from "../types";
import { renderAttention } from "./attention";
import { renderFilterBar } from "./filterBar";
import { mountTimeline } from "./timeline";

let mounted: { destroy(): void } | null = null;

// Bumped once per initApp() call so a slow, in-flight invocation (e.g. a
// pending query from a stale refresh click) can tell it's been superseded
// and bail instead of mounting into a canvas that's already been replaced.
let initEpoch = 0;

function loadFilters(): Filters {
  return sanitizeFilters(logseq.settings?.[SETTINGS_KEY]);
}
function saveFilters(f: Filters): void {
  logseq.updateSettings({ [SETTINGS_KEY]: f });
}

// Static chrome only — no graph content anywhere in this block. The button
// and error slot below are wired up in initApp() after this is assigned to
// canvas.innerHTML; any graph/exception content that ends up in the error
// slot goes in via messageEl()'s textContent pattern, never innerHTML.
const ONBOARDING_HTML = `<div class="tlp-message"><h3>Timeline setup needed</h3>
  <p>This graph is missing the <code>#tl</code> schema.</p>
  <p><button id="tlp-setup" class="tlp-primary">Create the schema for me</button></p>
  <div id="tlp-setup-error"></div>
  <p>Optional: for a dropdown on <code>tl-type</code>, open the property's settings and add choices <code>event</code>, <code>era</code>, <code>person</code> (once per graph, ~30 seconds). Entries typed without the dropdown work identically.</p>
  <p>or set it up manually (~1 minute):</p>
  <ol>
    <li>Create a tag named <code>tl</code> (type <code>#tl</code> in any block).</li>
    <li>On the <code>tl</code> tag page, add three tag properties:
      <ul>
        <li><code>tl-date</code> — type <b>Text</b> (NOT Date — a Date property stores journal-page
          references and will not work)</li>
        <li><code>tl-topic</code> — type <b>Node</b>, enable <b>multiple values</b></li>
        <li><code>tl-type</code> — type <b>Text</b> with choices <code>event</code>, <code>era</code>, <code>person</code></li>
      </ul></li>
    <li>Tag a node with <code>#tl</code>, fill in <code>tl-date</code>, and reopen this panel.</li>
  </ol></div>`;

// Builds a `.tlp-message` shell whose dynamic text is set via textContent,
// never interpolated into an HTML string — used for messages that embed a
// caught exception string or other runtime-derived text.
function messageEl(text: string): HTMLElement {
  const div = document.createElement("div");
  div.className = "tlp-message";
  div.textContent = text;
  return div;
}

export async function initApp(root: HTMLElement): Promise<void> {
  const epoch = ++initEpoch;
  root.innerHTML = `<div class="tlp-panel">
    <header class="tlp-header">
      <span>Timeline</span>
      <nav id="tlp-filters"></nav>
      <button id="tlp-close" title="Close">✕</button>
    </header>
    <div id="tlp-attention"></div>
    <main id="tlp-canvas"></main>
    <div id="tlp-tooltip" class="tlp-tooltip" hidden></div>
  </div>`;
  root.querySelector("#tlp-close")!.addEventListener("click", () => logseq.hideMainUI());
  const canvas = root.querySelector<HTMLElement>("#tlp-canvas")!;

  let isDb = true;
  try {
    // POC-verified (docs/superpowers/poc-findings.md §e): typed and returns
    // true on DB graphs in @logseq/libs 0.3.4. Keep the try/catch fallback
    // (assume DB, let query failures surface their own error) for older API
    // versions that may lack this method.
    // Library declares Promise<Boolean> (boxed) rather than Promise<boolean>;
    // coerce to the primitive to satisfy strict typechecking.
    isDb = Boolean(await logseq.App.checkCurrentIsDbGraph());
  } catch { /* keep true; query failure below still yields a clear error */ }
  if (epoch !== initEpoch) return; // superseded by a newer initApp() call while awaiting
  if (isDb === false) {
    canvas.innerHTML = `<div class="tlp-message">This plugin supports <b>DB graphs only</b>.</div>`;
    return;
  }

  const schema = await discoverSchema();
  if (epoch !== initEpoch) return; // superseded by a newer initApp() call while awaiting
  if (!schema) {
    canvas.innerHTML = ONBOARDING_HTML;
    const setupBtn = canvas.querySelector<HTMLButtonElement>("#tlp-setup")!;
    const setupError = canvas.querySelector<HTMLElement>("#tlp-setup-error")!;
    setupBtn.addEventListener("click", async () => {
      setupBtn.disabled = true;
      setupError.innerHTML = "";
      try {
        await setupSchema();
        await initApp(root); // success — re-run the full init, which re-discovers the schema
      } catch (e) {
        setupError.innerHTML = "";
        setupError.append(messageEl(`Setup failed: ${String(e)}`));
        setupBtn.disabled = false;
      }
    });
    return;
  }

  let nodes: TimelineNode[] = [];
  try {
    nodes = await fetchTimelineNodes(schema);
  } catch (e) {
    if (epoch !== initEpoch) return; // superseded by a newer initApp() call while awaiting
    canvas.innerHTML = "";
    canvas.append(messageEl(`Query failed: ${String(e)}. Try ↻ refresh.`));
    return;
  }
  if (epoch !== initEpoch) return; // superseded by a newer initApp() call while awaiting

  let filters = loadFilters();
  const { renderable, attention } = partitionNodes(nodes);
  renderAttention(root.querySelector<HTMLElement>("#tlp-attention")!, attention);

  // Sequence counter for the async hover preview: bumped on every onHover
  // call (including the null "pointer left" call). If the preview text
  // resolves after the pointer has already moved on (or left and come back),
  // its resolution is stale and must not clobber the current tooltip state.
  let hoverSeq = 0;

  const rerender = () => {
    if (epoch !== initEpoch) return; // stale init — canvas has already been replaced
    mounted?.destroy(); mounted = null;
    canvas.innerHTML = "";
    const visible = applyFilters(renderable, filters);
    if (visible.length === 0) {
      canvas.append(messageEl(
        `No events match the current filters (${filters.topics.length || "all"} topics, ${filters.types.length || "all"} types).`,
      ));
      return;
    }
    try {
      const build = buildChronosSource(visible, filters.erasAsBackground);
      const result = mountTimeline(canvas, build, {
        onOpen: (uuid, sidebar) => (sidebar ? openInSidebar(uuid) : openNode(uuid)),
        onHover: async (uuid) => {
          const seq = ++hoverSeq;
          const tip = root.querySelector<HTMLElement>("#tlp-tooltip")!;
          if (!uuid) { tip.hidden = true; return; }
          const text = await getPreviewText(uuid);
          if (seq !== hoverSeq) return; // pointer moved on (or off) before this resolved
          if (text) { tip.textContent = text; tip.hidden = false; }
        },
      });
      if ("error" in result) {
        canvas.innerHTML = "";
        canvas.append(messageEl(result.error));
      } else {
        mounted = result;
      }
    } catch (e) {
      // The chronos parser throws (rather than returning an error) on some
      // inputs that pass our own regex — e.g. reversed ranges (1945~1895),
      // invalid month/day (1874-13), or out-of-bounds years. Surface it
      // instead of letting the exception blank the canvas silently. Its
      // "Line N" counts lines in the generated chronos source, whose line 1
      // is our invisible `> NOTODAY` flag — shift by one so it lines up with
      // the entries the user actually sees.
      const msg = String(e).replace(/Line (\d+)/g, (_, n) => `entry ${Number(n) - 1}`);
      canvas.innerHTML = "";
      canvas.append(messageEl(
        `Timeline rendering failed: ${msg}. Check the tl-date values of recently edited entries.`,
      ));
    }
  };

  renderFilterBar(
    root.querySelector<HTMLElement>("#tlp-filters")!,
    renderable,
    filters,
    (f) => { filters = f; saveFilters(f); rerender(); },
    () => initApp(root),          // refresh = full re-query
  );
  rerender();
}
