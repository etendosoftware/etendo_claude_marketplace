# Known Bug: RegisterFields NullPointerException on core tables

## Symptom
`RegisterFields` fails with NPE when trying to register fields for a tab whose table belongs to core (M_Product, C_BPartner, etc.).

## Cause
Extension columns (EM_SMFT_*) don't have an associated AD_ELEMENT.

## Workaround
```sql
INSERT INTO ad_element (ad_element_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, columnname, name, printname)
SELECT get_uuid(), '0', '0', 'Y', now(), '0', now(), '0', c.columnname, c.name, c.name
FROM ad_column c
WHERE c.ad_table_id = '{TABLE_ID}'
  AND c.columnname ILIKE 'EM_%'
  AND NOT EXISTS (SELECT 1 FROM ad_element e WHERE LOWER(e.columnname) = LOWER(c.columnname));

UPDATE ad_column c SET ad_element_id = (
  SELECT ad_element_id FROM ad_element e WHERE LOWER(e.columnname) = LOWER(c.columnname) LIMIT 1
)
WHERE c.ad_table_id = '{TABLE_ID}' AND c.columnname ILIKE 'EM_%' AND c.ad_element_id IS NULL;
```
