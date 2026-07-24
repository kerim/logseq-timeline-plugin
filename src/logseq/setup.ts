import { PROP_DATE, PROP_TOPIC, PROP_TYPE, TAG_TITLE } from "../constants";

const TYPE_CHOICES = ["event", "era", "person"];

// Creates the #tl tag + tl-* properties. Types MUST be defined via
// upsertProperty before any value exists (Logseq locks inferred types).
// "Text" in the UI = type "default" (NOT "text", which is invalid).
export async function setupSchema(): Promise<void> {
  await logseq.Editor.upsertProperty(PROP_DATE, { type: "default" });
  await logseq.Editor.upsertProperty(PROP_TOPIC, { type: "node", cardinality: "many" });
  const typeProp = await logseq.Editor.upsertProperty(PROP_TYPE, { type: "default" });
  await logseq.Editor.createTag(TAG_TITLE, {
    tagProperties: [{ name: PROP_DATE }, { name: PROP_TOPIC }, { name: PROP_TYPE }],
  });
  // Best-effort: preset choices for tl-type. API takes BlockIdentity[] and the
  // mechanism for creating choice value-entities is undocumented — try the
  // plain-strings call, and if it throws, continue: choices are a UI nicety,
  // the plugin works without them and the README covers adding them manually.
  try {
    await logseq.Editor.addPropertyValueChoices(typeProp?.uuid ?? PROP_TYPE, TYPE_CHOICES);
  } catch (e) {
    console.warn("[timeline] preset tl-type choices failed (add manually if wanted):", e);
  }
}
