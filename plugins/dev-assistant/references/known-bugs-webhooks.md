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
