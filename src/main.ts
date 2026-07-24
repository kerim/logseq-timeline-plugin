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
  // Logseq's app header is full-width, 48px tall, z-index 10, and clickable.
  // zIndex: 11 loses to it on the desktop build, making the panel's top
  // strip (filter bar) unclickable — verified via browser-harness + live
  // web-Logseq inspection. Raise well above it.
  logseq.setMainUIInlineStyle({ zIndex: 9999 });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") logseq.hideMainUI(); });
  void syncTheme();
  logseq.App.onThemeModeChanged(({ mode }) => {
    document.documentElement.dataset.theme = mode === "dark" ? "dark" : "light";
  });
}

logseq.ready(main).catch(console.error);
