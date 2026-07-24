import "@logseq/libs";
import { initApp } from "./ui/app";

async function syncTheme() {
  const cfg = await logseq.App.getUserConfigs();
  document.documentElement.dataset.theme = cfg.preferredThemeMode === "dark" ? "dark" : "light";
}

function main() {
  logseq.provideModel({
    openTimeline() {
      logseq.showMainUI();
      void initApp(document.getElementById("app")!);
    },
  });
  logseq.App.registerUIItem("toolbar", {
    key: "timeline-open",
    template: `<a data-on-click="openTimeline" class="button" title="Open timeline">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/></svg>
    </a>`,
  });
  // Electron desktop Logseq has a -webkit-app-region: drag strip across the
  // top ~48px of the window. Drag regions are OS-level rectangles that punch
  // through overlays regardless of z-index, so no z-index value fixes a panel
  // that starts at top: 0 — the panel must be positioned below the strip
  // entirely. (Root-caused via browser-harness + live desktop-Logseq
  // inspection: the ✕ close button only ever worked because it happened to
  // sit under the header's own no-drag button island.) The panel's internal
  // 100vh layout needs no change — it's relative to this iframe's own box.
  logseq.setMainUIInlineStyle({ zIndex: 9999, top: "48px", height: "calc(100vh - 48px)" });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") logseq.hideMainUI(); });
  void syncTheme();
  logseq.App.onThemeModeChanged(({ mode }) => {
    document.documentElement.dataset.theme = mode === "dark" ? "dark" : "light";
  });
}

logseq.ready(main).catch(console.error);
