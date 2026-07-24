# Bug report for logseq/logseq

**Title:** `addPropertyValueChoices` plugin API silently fails: worker-side assert requires cljs uuids that JS callers cannot supply

---

**Version:** 2.0.1 (b09316a) — code references below are to current master (`4975d5c`).

The `logseq.Editor.addPropertyValueChoices(propertyId, choices)` plugin API cannot succeed when called from a plugin: the promise resolves, but no closed values are created.

## Root cause

1. `src/main/logseq/api/db_based.cljs` — `add-property-value-choices` converts the JS `choices` array via `bean/->clj`; uuid strings remain **strings**.
2. The values travel unchanged through `db-property-handler/add-existing-values-to-closed-values!` into the outliner op.
3. In the worker, `deps/outliner/src/logseq/outliner/property.cljs` `add-existing-values-to-closed-values!` hits:

   ```clojure
   (assert (every? uuid? values') "existing values should all be UUIDs")
   ```

   JS callers can only pass strings across the bridge, so this assert always fails.
4. The assert failure happens inside the transact path and never rejects the plugin-side promise — the API reports success while doing nothing, which makes this hard to diagnose from plugin land.

## Reproduction (any DB graph, plugin context)

```js
await logseq.Editor.upsertProperty("my-choice-prop", { type: "default" });
const b = await logseq.Editor.appendBlockInPage("test-page", "seed");
await logseq.Editor.upsertBlockProperty(b.uuid, "my-choice-prop", "red");
// collect the value entity's uuid via datascriptQuery, then:
await logseq.Editor.addPropertyValueChoices(prop.id, [valueUuidString]);
// resolves OK — but the property has no closed values afterward
```

## Suggested fix

Coerce at the API boundary, e.g. in `db_based.cljs`:

```clojure
(defn add-property-value-choices [property-id ^js choices]
  (when-let [values (and property-id (bean/->clj choices))]
    (db-property-handler/add-existing-values-to-closed-values!
     property-id (map #(if (string? %) (uuid %) %) values))))
```

Two related suggestions:

- (a) Consider exporting `upsert-closed-value!` to the plugin API — it accepts raw string values and is what the property-config UI uses, making it the natural way for plugins to predefine dropdown choices.
- (b) Transact failures inside `ui-outliner-tx` reaching a plugin API call should reject the returned promise rather than resolve it.

## Context

Found while building a timeline plugin whose one-click setup wanted to predefine choices (`event` / `era` / `person`) for a select-style property.
