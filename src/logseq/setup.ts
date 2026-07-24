import { PROP_DATE, PROP_TOPIC, PROP_TYPE, TAG_TITLE } from "../constants";

// Creates the #tl tag + tl-* properties. Types MUST be defined via
// upsertProperty before any value exists (Logseq locks inferred types).
// "Text" in the UI = type "default" (NOT "text", which is invalid).
export async function setupSchema(): Promise<void> {
  await logseq.Editor.upsertProperty(PROP_DATE, { type: "default" });
  await logseq.Editor.upsertProperty(PROP_TOPIC, { type: "node", cardinality: "many" });
  await logseq.Editor.upsertProperty(PROP_TYPE, { type: "default" });
  await logseq.Editor.createTag(TAG_TITLE, {
    tagProperties: [{ name: PROP_DATE }, { name: PROP_TOPIC }, { name: PROP_TYPE }],
  });
  // Presetting tl-type's dropdown choices from plugin JS is not possible:
  // addPropertyValueChoices ultimately calls Logseq's
  // add-existing-values-to-closed-values!, which asserts
  // `(every? uuid? values')` — it requires cljs UUID objects, but the JS
  // plugin bridge can only deliver strings, and nothing on the Logseq side
  // coerces them. The assert fails inside the worker, invisible to the
  // plugin's promise. Upstream bug; not fixable from here. The schema
  // itself (tag + all three properties) is fully created and works without
  // the dropdown — see the onboarding screen's manual-choices note.
  console.info("[timeline] tl-type dropdown choices can't be preset by plugins (Logseq bug: addPropertyValueChoices requires cljs uuid objects unreachable from JS). Add choices manually if wanted.");
}
