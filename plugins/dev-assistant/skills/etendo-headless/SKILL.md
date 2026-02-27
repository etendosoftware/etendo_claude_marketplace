---
description: "/etendo:headless — Configure EtendoRX headless API endpoints"
argument-hint: "[list | create name | alter name | test name]"
---

# /etendo:headless — Configure EtendoRX headless API endpoints

**Arguments:** `$ARGUMENTS` (optional: endpoint name, table name, or description)

---

First, read `skills/etendo-_guidelines/SKILL.md` and `skills/etendo-_context/SKILL.md`.
Also read `docs/etendo-headless.md` for the full EtendoRX API reference.

This command creates or modifies EtendoRX headless endpoints -- REST API endpoints that expose Etendo data without CSRF, using JWT Bearer or Basic Auth.

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
- `list` -> show existing endpoints for the active module
- `create {name}` or blank -> create a new endpoint
- `alter {name}` / `add-field {name}` -> add fields to existing endpoint
- `test {name}` -> test an endpoint with a curl call

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
   - "Let me pick" -> multi-select
   - Common safe defaults: id, name/description, isactive, key business fields

4. **Operations allowed**: GET (list/fetch), POST (create), PUT (update)? Default: all three.

## Step 4: Register via webhook

Use the `RegisterHeadlessEndpoint` webhook (requires Tomcat running + API key):

```bash
ETENDO_URL=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('etendoUrl','http://localhost:8080/etendo'))")
API_KEY=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('apikey',''))")

# moduleId is NOT stored in context.json — resolve it from the module's javapackage:
MODULE_JP=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('module',''))")
MODULE_ID=$(docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c \
  "SELECT ad_module_id FROM ad_module WHERE javapackage = '${MODULE_JP}';" | tr -d ' ')

# Register by table name (auto-resolves to first header tab):
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterHeadlessEndpoint&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"RequestName\": \"{EndpointName}\",
    \"ModuleID\": \"${MODULE_ID}\",
    \"TableName\": \"{db_table_name}\",
    \"Description\": \"{description}\"
  }")
echo $RESP

# Or register by explicit TabID:
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterHeadlessEndpoint&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"RequestName\": \"{EndpointName}\",
    \"ModuleID\": \"${MODULE_ID}\",
    \"TabID\": \"{AD_TAB_ID}\"
  }")
echo $RESP
```

If Tomcat is not running, fall back to SQL:
```sql
DO $$
DECLARE
  v_req_id        TEXT := get_uuid();
  v_oapi_tab_id   TEXT := get_uuid();
  v_module_id     TEXT := '{AD_MODULE_ID}';
  v_tab_id        TEXT := '{AD_TAB_ID}';
BEGIN
  INSERT INTO ETAPI_OPENAPI_REQ (
    ETAPI_OPENAPI_REQ_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
    NAME, AD_MODULE_ID
  ) VALUES (v_req_id, '0', '0', 'Y', now(), '0', now(), '0', '{EndpointName}', v_module_id);

  INSERT INTO ETRX_OPENAPI_TAB (
    ETRX_OPENAPI_TAB_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
    ETAPI_OPENAPI_REQ_ID, AD_TAB_ID, AD_MODULE_ID
  ) VALUES (v_oapi_tab_id, '0', '0', 'Y', now(), '0', now(), '0', v_req_id, v_tab_id, v_module_id);
END $$;
```

## Step 5: Execute and verify

Execute the SQL. Then test the endpoint immediately:

```bash
# Get a JWT — use System Administrator (role "0") for admin operations
ETENDO_TOKEN=$(curl -s -X POST "${ETENDO_URL}/sws/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"0"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# Test GET
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/{EndpointName}?_startRow=0&_endRow=5" \
  | python3 -m json.tool
```

If the test returns 401/403: explain SWS access configuration requirement (must create `etrx_rx_services_access` record linking user -> auth service). See `docs/headless-setup.sql`.

## Step 6: Export and summarize

**Important:** `export.database` requires Tomcat to be stopped first.

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "$JAVA_HOME")
JAVA_HOME=${JAVA_HOME} ./gradlew resources.down
JAVA_HOME=${JAVA_HOME} ./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
# Bring services back up after export:
JAVA_HOME=${JAVA_HOME} ./gradlew resources.up
```

```
+ Endpoint configured: {EndpointName}

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
