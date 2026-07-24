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
  // Choices: addPropertyValueChoices converts EXISTING property values into
  // closed choices (verified against logseq/logseq source + tests). On a clean
  // graph no values exist yet, so: write each choice value onto a scratch
  // block in a temp page (creating the value entities), collect the value
  // entities' uuids by query, convert them, then delete the temp page.
  // Best-effort: any failure leaves a fully working schema, minus dropdown.
  // lastStage is tracked so a failure names exactly where it happened —
  // CLI-diagnosed: value entities WERE created correctly in a prior run, but
  // the conversion call itself threw (see propId comment below).
  const TEMP_PAGE = "tlp-setup-temp";
  let lastStage: "seed" | "collect" | "convert" | "cleanup" = "seed";
  try {
    await logseq.Editor.createPage(TEMP_PAGE, {}, { redirect: false, createFirstBlock: false });
    let seeded = 0;
    for (const v of TYPE_CHOICES) {
      const b = await logseq.Editor.appendBlockInPage(TEMP_PAGE, `choice seed ${v}`);
      if (b) {
        await logseq.Editor.upsertBlockProperty(b.uuid, PROP_TYPE, v);
        seeded++;
      }
    }
    console.log(`[timeline] setup: seeded ${seeded} choice blocks`);

    lastStage = "collect";
    // Collect the value entities' uuids via the property ident (plugin-created
    // idents are plugin-namespaced; discover by title like schema.ts does).
    // Exclude empty-title values, which otherwise sneak into the result set.
    const rows: unknown[][] = (await logseq.DB.datascriptQuery(`
      [:find ?vuuid
       :where [?p :block/title "${PROP_TYPE}"] [?p :db/ident ?ident]
              [?b ?ident ?v] [?v :block/uuid ?vuuid]
              [?v :block/title ?vt] [(not= ?vt "")]]`)) ?? [];
    const uuids = [...new Set(rows.map((r) => String(r[0])))];
    console.log(`[timeline] setup: collected ${uuids.length} value uuids`);

    lastStage = "convert";
    if (uuids.length > 0) {
      // Logseq's own UI (src/main/frontend/components/property/config.cljs)
      // calls addPropertyValueChoices with the property's numeric :db/id, not
      // its uuid — despite the TS typing being BlockIdentity (string |
      // {uuid}). Numeric id first, matching the real UI; uuid and the
      // property name are fallbacks if upsertProperty didn't return an id.
      const propId = (typeProp as { id?: number }).id ?? (typeProp as { uuid?: string }).uuid ?? PROP_TYPE;
      await logseq.Editor.addPropertyValueChoices(propId as any, uuids); // eslint-disable-line @typescript-eslint/no-explicit-any -- BlockIdentity's declared type (string | {uuid}) doesn't include the numeric db/id Logseq's own UI actually passes
      console.log("[timeline] setup: choices conversion OK");
    } else {
      console.warn("[timeline] setup: no value uuids collected, skipping choices conversion");
    }

    lastStage = "cleanup";
    await logseq.Editor.deletePage(TEMP_PAGE);
  } catch (e) {
    console.warn("[timeline] choices step failed at:", lastStage, e);
    try {
      await logseq.Editor.deletePage(TEMP_PAGE);
    } catch (cleanupErr) {
      console.warn("[timeline] choices step: temp page cleanup also failed:", cleanupErr);
    }
  }
}
