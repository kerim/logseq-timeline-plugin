// DEBUG HARNESS — not part of the plugin build. Mocks the `logseq` global
// so the panel can run in a plain browser tab for interactive debugging.
import { initApp } from "./ui/app";

const identRows = [
  [{ title: "tl-date", ident: ":user.property/tl-date-x1" }],
  [{ title: "tl-topic", ident: ":user.property/tl-topic-x2" }],
  [{ title: "tl-type", ident: ":user.property/tl-type-x3" }],
];

const topicJapan = { title: "japan", uuid: "topic-japan", content: "japan", "full-title": "japan" };
const topicTaiwan = { title: "taiwan", uuid: "topic-taiwan", content: "taiwan", "full-title": "taiwan" };
const topicPrehistory = { title: "prehistory", uuid: "topic-prehistory", content: "prehistory", "full-title": "prehistory" };

const nodeRows = [
  [{
    title: "Mudan Shi Incident", uuid: "node-mudan", content: "Mudan Shi Incident", "full-title": "Mudan Shi Incident",
    ":user.property/tl-date-x1": { title: "1874-05-22" },
    ":user.property/tl-topic-x2": [topicTaiwan, topicJapan],
    ":user.property/tl-type-x3": { title: "event" },
  }],
  [{
    title: "Japanese colonial period", uuid: "node-colonial", content: "Japanese colonial period", "full-title": "Japanese colonial period",
    ":user.property/tl-date-x1": { title: "1600~1945" },
    ":user.property/tl-topic-x2": [topicTaiwan, topicJapan],
    ":user.property/tl-type-x3": { title: "era" },
  }],
  [{
    title: "Ancient test", uuid: "node-ancient", content: "Ancient test", "full-title": "Ancient test",
    ":user.property/tl-date-x1": { title: "-500" },
    ":user.property/tl-topic-x2": [topicPrehistory],
    ":user.property/tl-type-x3": { title: "event" },
  }],
  [{
    title: "Broken test", uuid: "node-broken", content: "Broken test", "full-title": "Broken test",
    ":user.property/tl-date-x1": { title: "sometime in spring" },
  }],
  [{
    title: "Meiji era", uuid: "node-meiji", content: "Meiji era", "full-title": "Meiji era",
    ":user.property/tl-date-x1": { title: "1550~1555" },
    ":user.property/tl-topic-x2": [topicJapan],
    ":user.property/tl-type-x3": { title: "era" },
  }],
  // Overlapping long eras — reproduces the background-wash label clash
  // (their labels all print at the band's top-left and pile up).
  [{
    title: "Middle Ages", uuid: "node-ma", content: "Middle Ages", "full-title": "Middle Ages",
    ":user.property/tl-date-x1": { title: "0476~1500" },
    ":user.property/tl-topic-x2": [topicPrehistory],
    ":user.property/tl-type-x3": { title: "Era" },
  }],
  [{
    title: "Islamic Golden Age", uuid: "node-iga", content: "Islamic Golden Age", "full-title": "Islamic Golden Age",
    ":user.property/tl-date-x1": { title: "0750~1258" },
    ":user.property/tl-topic-x2": [topicPrehistory],
    ":user.property/tl-type-x3": { title: "Era" },
  }],
  [{
    title: "Song dynasty", uuid: "node-song", content: "Song dynasty", "full-title": "Song dynasty",
    ":user.property/tl-date-x1": { title: "0960~1279" },
    ":user.property/tl-topic-x2": [topicPrehistory],
    ":user.property/tl-type-x3": { title: "Era" },
  }],
];

let settingsStore: Record<string, unknown> = {};

(window as unknown as { logseq: unknown }).logseq = {
  get settings() { return settingsStore; },
  updateSettings(patch: Record<string, unknown>) {
    settingsStore = { ...settingsStore, ...patch };
    console.log("[harness] updateSettings", JSON.stringify(patch));
  },
  hideMainUI() { console.log("[harness] hideMainUI"); },
  showMainUI() { console.log("[harness] showMainUI"); },
  setMainUIInlineStyle() {},
  provideModel() {},
  ready(cb?: () => void) { cb?.(); return Promise.resolve(); },
  App: {
    checkCurrentIsDbGraph: async () => true,
    pushState(...args: unknown[]) { console.log("[harness] pushState", JSON.stringify(args)); },
    getUserConfigs: async () => ({ preferredThemeMode: "light" }),
    onThemeModeChanged() {},
    registerUIItem() {},
  },
  Editor: {
    openInRightSidebar(uuid: string) { console.log("[harness] openInRightSidebar", uuid); },
    getBlock: async (uuid: string) => ({ children: [{ content: `Preview text for ${uuid} — lorem ipsum details about this event.` }] }),
  },
  DB: {
    datascriptQuery: async (q: string) => {
      if (q.includes("namespace")) return identRows;   // ident-discovery query
      if (q.includes(":block/tags")) return nodeRows;  // node query
      return [];
    },
  },
};

void initApp(document.getElementById("app")!);
