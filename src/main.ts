import "@logseq/libs";

function openPanel() {
  logseq.showMainUI();
}

function main() {
  logseq.provideModel({ openTimeline: openPanel });

  logseq.App.registerUIItem("toolbar", {
    key: "timeline-open",
    template: `<a data-on-click="openTimeline" class="button" title="Open timeline">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/></svg>
    </a>`,
  });

  logseq.setMainUIInlineStyle({ zIndex: 11 });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") logseq.hideMainUI();
  });

  const app = document.getElementById("app")!;
  app.innerHTML = `<div class="tlp-panel"><header class="tlp-header">
      <span>Timeline</span>
      <button id="tlp-close" title="Close">✕</button>
    </header><main id="tlp-body"></main></div>`;
  document.getElementById("tlp-close")!.addEventListener("click", () => logseq.hideMainUI());

  const body = document.getElementById("tlp-body")!;
  const probeBtn = document.createElement("button");
  probeBtn.textContent = "Run POC probe";
  probeBtn.onclick = async () => {
    body.innerHTML = "";
    const { runProbe } = await import("./poc");
    await runProbe(body);
  };
  body.append(probeBtn);
}

logseq.ready(main).catch(console.error);
