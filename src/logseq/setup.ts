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
  try {
    const TEMP_PAGE = "tlp-setup-temp";
    await logseq.Editor.createPage(TEMP_PAGE, {}, { redirect: false, createFirstBlock: false });
    for (const v of TYPE_CHOICES) {
      const b = await logseq.Editor.appendBlockInPage(TEMP_PAGE, `choice seed ${v}`);
      if (b) await logseq.Editor.upsertBlockProperty(b.uuid, PROP_TYPE, v);
    }
    // Collect the value entities' uuids via the property ident (plugin-created
    // idents are plugin-namespaced; discover by title like schema.ts does).
    const rows: unknown[][] = (await logseq.DB.datascriptQuery(`
      [:find ?vuuid
       :where [?p :block/title "${PROP_TYPE}"] [?p :db/ident ?ident]
              [?b ?ident ?v] [?v :block/uuid ?vuuid]]`)) ?? [];
    const uuids = [...new Set(rows.map((r) => String(r[0])))];
    if (uuids.length > 0) {
      await logseq.Editor.addPropertyValueChoices(typeProp.uuid ?? (typeProp as { id?: number }).id ?? PROP_TYPE, uuids);
    }
    await logseq.Editor.deletePage(TEMP_PAGE);
  } catch (e) {
    console.warn("[timeline] preset tl-type choices failed (add manually if wanted):", e);
    try { await logseq.Editor.deletePage("tlp-setup-temp"); } catch { /* already gone */ }
  }
}
