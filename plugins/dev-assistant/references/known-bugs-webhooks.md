# Known Bugs & Workarounds: com.etendoerp.copilot.devassistant Webhooks

Known issues in the webhooks provided by `com.etendoerp.copilot.devassistant`. Skills should check this file before calling webhooks, and apply workarounds automatically when possible.

---

## B1: CreateColumn — canBeNull does not accept "Y"/"N" — FIXED

- **Symptom:** Column is created as NOT NULL even when passing `canBeNull: "Y"`.
- **Cause:** The webhook used `StringUtils.equalsIgnoreCase(canBeNull, "true")` — it only recognized `"true"`/`"false"`.
- **Fix:** Now accepts both `"true"`/`"false"` and `"Y"`/`"N"`.

## B2: CreateColumn — prefix duplication on core tables — FIXED

- **Symptom:** Passing `"columnNameDB": "SMFT_Is_Course"` on a core table (e.g. M_Product) creates `EM_SMFT_SMFT_Is_Course`.
- **Cause:** The webhook always added `EM_{PREFIX}_` to the column name when the table belongs to core. If the name already included the prefix, it got duplicated.
- **Fix:** Now detects if `columnNameDB` already starts with the module prefix and skips adding it again.

## B3: CreateModule — templates cannot have DBPrefix — FIXED

- **Symptom:** `CreateModule` with `Type=T` and `DBPrefix` fails with trigger error `@DBPrefixNotAllowedInTemplate@`.
- **Cause:** The DB trigger `ad_module_dbprefix_trg` blocks insertion of prefixes for template-type modules (Type=T). The webhook always tried to create the prefix regardless of module type.
- **Fix:** `CreateModule` now skips `createModuleDBPrefix()` when `type` is `"T"`.

## B4: AddModuleDependency — compile error with setIsIncluded — FIXED

- **Symptom:** The webhook failed to compile with `cannot find symbol: method setIsIncluded(boolean)`.
- **Cause:** The generated entity method is `setIncluded(Boolean)`, not `setIsIncluded`.
- **Fix:** Already corrected in the current codebase — uses `dep.setIncluded(isIncluded)`.

## B5: RegisterFields — NullPointerException on core tables — MITIGATED

- **Symptom:** `RegisterFields` fails with NPE when registering fields for a tab whose table belongs to core (e.g. M_Product, C_BPartner).
- **Cause:** Extension columns (`EM_*`) don't have an associated `AD_ELEMENT` record.
- **Mitigation:** `CreateColumn` now calls `ensureElementLinked()` which creates the `AD_ELEMENT` automatically when adding columns. If the column was created before this fix, use the SQL workaround:
```sql
-- Create missing AD_ELEMENT records for EM_ columns
INSERT INTO ad_element (ad_element_id, ad_client_id, ad_org_id, isactive,
  created, createdby, updated, updatedby, columnname, name, printname)
SELECT get_uuid(), '0', '0', 'Y', now(), '0', now(), '0',
  c.columnname, c.name, c.name
FROM ad_column c
WHERE c.ad_table_id = '{TABLE_ID}'
  AND c.columnname ILIKE 'EM_%'
  AND NOT EXISTS (
    SELECT 1 FROM ad_element e
    WHERE LOWER(e.columnname) = LOWER(c.columnname)
  );

-- Link columns to their elements
UPDATE ad_column c SET ad_element_id = (
  SELECT ad_element_id FROM ad_element e
  WHERE LOWER(e.columnname) = LOWER(c.columnname) LIMIT 1
)
WHERE c.ad_table_id = '{TABLE_ID}'
  AND c.columnname ILIKE 'EM_%'
  AND c.ad_element_id IS NULL;
```
Then retry `RegisterFields`.

## B6: CreateColumn — fieldlength = 0 for certain reference types — WORKAROUND

- **Symptom:** After creating columns, the UI field is uneditable (zero-width input box). Mandatory fields block saving entirely since users cannot enter a value.
- **Cause:** The `CreateColumn` webhook may set `fieldlength = 0` for certain reference types (Text, Integer, Number, Date), especially when no explicit length is passed.
- **Workaround:** After column creation, validate and fix `fieldlength`:
```sql
-- Find affected columns
SELECT columnname, fieldlength, ad_reference_id FROM ad_column
WHERE ad_table_id = '{TABLE_ID}' AND fieldlength = 0;

-- Fix with recommended values per reference type:
-- String(10)→60-200, Text(14)→2000, Integer(11)→10, Number(22)→10, Date(15)→19, Yes/No(20)→1
UPDATE ad_column SET fieldlength = {value} WHERE ad_column_id = '{COL_ID}';
```
- **Impact:** Also affects `ad_field.displaylength` — see B7.

## B7: RegisterFields — displaylength NULL or 0 → NullPointerException — WORKAROUND

- **Symptom:** Window fails to open with `NullPointerException: Cannot invoke "java.lang.Long.longValue()" because the return value of "Field.getDisplayedLength()" is null`.
- **Cause:** `RegisterFields` may create `ad_field` records with `displaylength = NULL` or `0`, inheriting from the column's `fieldlength`. If the column's `fieldlength` is `0` (see B6), the field gets the same broken value.
- **Workaround:** After `RegisterFields`, always validate and fix:
```sql
UPDATE ad_field f SET displaylength = c.fieldlength
FROM ad_column c
WHERE f.ad_column_id = c.ad_column_id
  AND f.ad_tab_id = '{TAB_ID}'
  AND (f.displaylength IS NULL OR f.displaylength = 0);
```

## B8: RegisterTab — missing boolean defaults → window rendering failures — WORKAROUND

- **Symptom:** Window fails to render with various errors (FreeMarker exceptions, NullPointerExceptions) when opening a tab.
- **Cause:** `RegisterTab` (or SQL-based tab creation) may leave `ad_tab.processing` and `ad_tab.importfields` as NULL. These columns must be `'N'`.
- **Workaround:** After tab creation, ensure all required boolean columns have values:
```sql
UPDATE ad_tab SET
  processing = COALESCE(processing, 'N'),
  importfields = COALESCE(importfields, 'N')
WHERE ad_tab_id = '{TAB_ID}';
```

## B9: Window — ad_table.ad_window_id not set → FreeMarker tabView error — WORKAROUND

- **Symptom:** Window fails with `freemarker.template.TemplateModelException: get(tabView) failed on instance of StandardWindowComponent`.
- **Cause:** After creating a window and registering a tab, the `ad_table.ad_window_id` column on the underlying table is not updated to point to the new window. The `RegisterWindow`/`RegisterTab` webhooks don't set this link automatically.
- **Workaround:** After window+tab creation, link each table to its window:
```sql
UPDATE ad_table SET ad_window_id = '{WINDOW_ID}'
WHERE ad_table_id = (SELECT ad_table_id FROM ad_tab WHERE ad_tab_id = '{TAB_ID}')
  AND ad_window_id IS NULL;
```
