# /etendo:headless — Configure EtendoRX headless API endpoints

**Arguments:** `$ARGUMENTS` (optional: endpoint name, table name, or description)

---

First, read `.claude/commands/etendo/_context.md`.
Also read `docs/etendo-headless.md` for the full EtendoRX API reference.

This command creates or modifies EtendoRX headless endpoints — REST API endpoints that expose Etendo data without CSRF, using JWT Bearer or Basic Auth.

**Key concept:** Each endpoint (`ETAPI_OPENAPI_REQ`) is mapped to one or more Tabs (`ETRX_OPENAPI_TAB`). Each tab exposes specific fields (`ETRX_ENTITY_FIELD`). The endpoint name becomes the URL segment:
```
GET/POST/PUT /etendo/sws/com.etendoerp.etendorx.datasource/{EndpointName}
```

## Step 1: Check EtendoRX is available

Verify the module is installed:
```sql
SELECT javapackage FROM ad_module WHERE javapackage = 'com.etendoerp.etendorx' AND isactive = 'Y';
```

If not present: "EtendoRX module is not installed. Add `implementation('com.etendoerp:etendorx:[version]')` to build.gradle and run `./gradlew update.database`."

Check EtendoRX service is running (if Docker):
```bash
docker ps --filter name=etendo-etendorx --format "{{.Names}} {{.Status}}"
```

## Step 2: Determine operation

Based on `$ARGUMENTS`:
- `list` → show existing endpoints for the active module
- `create {name}` or blank → create a new endpoint
- `alter {name}` / `add-field {name}` → add fields to existing endpoint
- `test {name}` → test an endpoint with a curl call

**List existing endpoints:**
```sql
SELECT r.name AS endpoint, t.name AS tab_name, tbl.tablename,
       COUNT(f.etrx_entity_field_id) AS field_count
FROM etapi_openapi_req r
JOIN etrx_openapi_tab t ON t.etapi_openapi_req_id = r.etapi_openapi_req_id
JOIN ad_tab tab ON tab.ad_tab_id = t.ad_tab_id
JOIN ad_table tbl ON tbl.ad_table_id = tab.ad_table_id
LEFT JOIN etrx_entity_field f ON f.etrx_openapi_tab_id = t.etrx_openapi_tab_id
WHERE r.ad_module_id = '{AD_MODULE_ID}'
GROUP BY r.name, t.name, tbl.tablename
ORDER BY r.name;
```

## Step 3: Gather information (for create)

Ask conversationally:

1. **Endpoint name** (becomes URL segment): e.g. `MyCustomers`
   - Convention: PascalCase, noun, no spaces
   - Will be accessible at `/sws/com.etendoerp.etendorx.datasource/MyCustomers`

2. **Which Tab to expose?** List available tabs:
   ```sql
   SELECT t.ad_tab_id, t.name, tbl.tablename
   FROM ad_tab t
   JOIN ad_table tbl ON tbl.ad_table_id = t.ad_table_id
   WHERE t.ad_module_id = '{AD_MODULE_ID}'
   ORDER BY t.name;
   ```
   (Or allow specifying a core tab like `C_Order` tab 186)

3. **Which fields to expose?** List columns for the selected tab:
   ```sql
   SELECT c.columnname, c.name, c.ad_reference_id
   FROM ad_column c
   JOIN ad_table tbl ON tbl.ad_table_id = c.ad_table_id
   WHERE tbl.ad_table_id = '{table_id}'
   ORDER BY c.columnname;
   ```
   Options:
   - "All columns"
   - "Let me pick" → multi-select
   - Common safe defaults: id, name/description, isactive, key business fields

4. **Operations allowed**: GET (list/fetch), POST (create), PUT (update)? Default: all three.

## Step 4: Generate SQL

```sql
DO $$
DECLARE
  v_req_id        TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  v_oapi_tab_id   TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  v_module_id     TEXT := '{AD_MODULE_ID}';
  v_tab_id        TEXT := '{AD_TAB_ID}';
  -- one v_field_id per field
BEGIN

  -- 1. OpenAPI Request (the endpoint definition)
  INSERT INTO ETAPI_OPENAPI_REQ (
    ETAPI_OPENAPI_REQ_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
    NAME, AD_MODULE_ID
  ) VALUES (
    v_req_id, '0', '0', 'Y', now(), '0', now(), '0',
    '{EndpointName}', v_module_id
  );

  -- 2. OpenAPI Tab (maps endpoint to a Tab/table)
  INSERT INTO ETRX_OPENAPI_TAB (
    ETRX_OPENAPI_TAB_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
    ETAPI_OPENAPI_REQ_ID, AD_TAB_ID, AD_MODULE_ID
  ) VALUES (
    v_oapi_tab_id, '0', '0', 'Y', now(), '0', now(), '0',
    v_req_id, v_tab_id, v_module_id
  );

  -- 3. Entity Fields (one per exposed column)
  INSERT INTO ETRX_ENTITY_FIELD (
    ETRX_ENTITY_FIELD_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
    ETRX_OPENAPI_TAB_ID, NAME, AD_MODULE_ID, FIELDMAPPING
  ) VALUES
    (REPLACE(gen_random_uuid()::text, '-', ''), '0', '0', 'Y', now(), '0', now(), '0',
     v_oapi_tab_id, '{columnname}', v_module_id, '{columnname}'),
  -- ... repeat for each field
  ;

END $$;
```

Show complete SQL. Ask: "Execute? (Y/N)"

## Step 5: Execute and verify

Execute the SQL. Then test the endpoint immediately:

```bash
# Get a JWT first (requires SWS access configured for the user)
TOKEN=$(curl -s -X POST http://localhost:8080/{context.name}/sws/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin","role":"{swsLoginRole}"}' | jq -r '.token')

# Test GET
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/{context.name}/sws/com.etendoerp.etendorx.datasource/{EndpointName}?_startRow=0&_endRow=5" \
  | jq '.response.data[0]'
```

If the test returns 401/403: explain SWS access configuration requirement (must create `etrx_rx_services_access` record linking user → auth service). See `docs/headless-setup.sql`.

## Step 6: Export and summarize

```bash
./gradlew export.database -Dmodule={javapackage}
```

```
✓ Endpoint configured: {EndpointName}

  URL: GET/POST/PUT http://localhost:8080/{context}/sws/com.etendoerp.etendorx.datasource/{EndpointName}
  Auth: Bearer {JWT}  or  Basic {base64(user:pass)}
  Fields: {field1}, {field2}, ...

  Example GET:
    curl -H "Authorization: Bearer $TOKEN" \
      "http://localhost:8080/{context}/sws/com.etendoerp.etendorx.datasource/{EndpointName}"

  To use from code (see poc/server/src/etendo.js):
    const client = makeHeadlessClient('{etendoUrl}', authorization)
    client.get('{EndpointName}', 'id=="{id}"')
```
