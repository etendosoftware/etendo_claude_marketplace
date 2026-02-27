---
description: "/etendo:alter-db — Create or modify tables, columns, views, and references in the Etendo Application Dictionary via webhooks"
argument-hint: "<description, e.g. 'create table SMFT_customer with name and email'>"
---

# /etendo:alter-db — Create or modify tables and columns

**Arguments:** `$ARGUMENTS` (optional description, e.g., "create table SMFT_customer with name and email")

---

First, read `skills/etendo-_context/SKILL.md` and `skills/etendo-_webhooks/SKILL.md`.

## Headless REST endpoints (complement to webhooks)

These EtendoRX headless endpoints provide read/query capabilities for inspecting existing tables and columns. Base URL: `{ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/`.

| Endpoint | Methods | Use for |
|---|---|---|
| `Table` | GET, PUT | Read table metadata, check if a table exists |
| `Column` | GET, PUT | Read column metadata for a table |
| `ModulePrefix` | GET | Look up a module's DB prefix |
| `Reference` | GET | Look up reference types (String, Integer, etc.) |
| `ValidationSetup` | GET, POST, PUT | Manage validation rules |
| `TableTreeConfiguration` | GET, POST, PUT | Configure tree structures for tables |

Use headless GET for **reading/querying** existing data. For **creation or structured operations**, always use webhooks.

## Post-creation sequence (mandatory)

After creating or modifying any table, column, or view, you **must** run this sequence in order:

1. **`CheckTablesColumnHook`** (TableChecker) — Detects column changes and runs column registration procedures
2. **`SyncTerms`** — Synchronizes terms/translations across the system
3. **`ElementsHandler`** — Reads and corrects elements if required

```bash
# Run after every table/column/view creation:
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CheckTablesColumnHook&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"TableID\": \"${TABLE_ID}\"}"

curl -s -X POST "${ETENDO_URL}/webhooks/?name=SyncTerms&apikey=${API_KEY}" \
  -H "Content-Type: application/json" -d '{}'

curl -s -X POST "${ETENDO_URL}/webhooks/?name=ElementsHandler&apikey=${API_KEY}" \
  -H "Content-Type: application/json" -d '{}'
```

Never skip or reorder these steps. They ensure the Application Dictionary stays consistent.

## Step 1: Context

Resolve:
- Active module (javapackage, DB prefix, AD_MODULE_ID)
- DB connection (Docker or local)
- API key available (see `_webhooks` skill — section "Prerequisite: API Key")
- Tomcat running (webhooks require Tomcat UP → `./gradlew resources.up` if it's down)

## Step 2: Understand the change

If `$ARGUMENTS` describes it clearly, use it. Otherwise, ask:

1. Create new table (via webhook)
2. Add column to existing table (via webhook)
3. Create a view (via webhook)
4. Create a reference — list or table type (via headless endpoints)
5. Modify column — type, size, nullable (manual SQL — no webhook available)
6. Add index (manual SQL — no webhook available)
7. Delete column (manual SQL — destructive, confirm first)
8. Inspect existing table/column info

For **new table**: ask for name (suggest `{PREFIX}_tablename`), list of columns.
For **new column**: table, name, type, nullable, default.
For **new view**: ask for name, source query.
For **inspect**: use the `GetWindowTabOrTableInfo` webhook or headless `Table`/`Column` endpoints.

**Inspect existing structures:**
```bash
# Via webhook (returns detailed AD info):
curl -s -X POST "${ETENDO_URL}/webhooks/?name=GetWindowTabOrTableInfo&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"TableName\": \"{PREFIX_TableName}\"}"

# Via headless (simpler metadata):
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/Table?dBTableName={PREFIX_TableName}"
```

## Step 3: Show the plan and confirm

Display a summary of what will be created. Ask for confirmation before executing.

## Step 4: Create table (if applicable)

Use the `CreateAndRegisterTable` webhook. This creates the physical table in PostgreSQL AND registers it in AD_TABLE in a single call:

```bash
ETENDO_URL="http://localhost:8080/etendo"  # or the port from context.json
API_KEY="{apikey}"
MODULE_ID="{ad_module_id}"

RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateAndRegisterTable&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "{LogicalName}",
    "DBTableName": "{PREFIX_TableName}",
    "ModuleID": "'${MODULE_ID}'",
    "DataAccessLevel": "3",
    "Description": "{description}",
    "Help": "{description}",
    "JavaClass": "{javapackage}.data.{EntityName}"
  }')

echo $RESP
TABLE_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
echo "Table ID: $TABLE_ID"
```

**Do not use `get_uuid()` or manual SQL** — the webhook handles it internally.

## Step 5: Add columns

For each column, use `CreateColumn`:

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateColumn&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "tableID": "'${TABLE_ID}'",
    "columnNameDB": "{column_name}",
    "name": "{Visible Name}",
    "referenceID": "{REF_ID}",
    "moduleID": "'${MODULE_ID}'",
    "canBeNull": "{true|false}",
    "defaultValue": "{value}"
  }'
```

**Most used Reference IDs:**
| ID | Type | When to use |
|---|---|---|
| `10` | String | Short texts, names (AD default length 60, webhook creates VARCHAR 200) |
| `14` | Text | Long descriptions, notes |
| `11` | Integer | Whole numbers, numeric codes |
| `22` | Amount/Decimal | Prices, scores, durations |
| `15` | Date | Dates |
| `20` | Yes/No | Checkboxes, boolean flags |
| `17` | List | Fields with a closed list of values |
| `19` | TableDir | FK to another table in the same module |
| `30` | Search | FK to a table in another module |

**For FK columns to tables from ANOTHER module**, the webhook automatically adds the `EM_` prefix — no need to specify it manually.

## Step 5b: Create view (if applicable)

Use the `CreateView` webhook for database views:

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateView&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "{LogicalName}",
    "DBTableName": "{PREFIX_ViewName}",
    "ModuleID": "'${MODULE_ID}'",
    "DataAccessLevel": "3",
    "Description": "{description}",
    "Help": "{description}"
  }')
echo $RESP
```

The `CreateView` webhook checks columns and registers the view automatically.

## Step 5c: Create reference (if applicable)

References define field value constraints — either a fixed **list** of values or a **table lookup**. These use headless endpoints (base URL: `{ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/`).

### List reference (Reference ID `17`)

A list reference provides a closed set of values (e.g., Status: Active/Inactive/Pending).

```bash
# 1. Look up the module ID via prefix:
MODULE_RESP=$(curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/ModulePrefix?name={PREFIX}")
# Save the "module" property (NOT "id") — this is the AD_MODULE_ID

# 2. Create the reference header (parentReference="17" for list type):
HEADER_RESP=$(curl -s -X POST \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/ReferencesHeader" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"{ReferenceName}\",
    \"description\": \"{description}\",
    \"helpComment\": \"{help}\",
    \"parentReference\": \"17\",
    \"module\": \"${MODULE_ID}\"
  }")
# Extract the header ID from the response

# 3. Create list items (one per value):
curl -s -X POST \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/ReferencesList" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"reference\": \"${HEADER_ID}\",
    \"name\": \"{ItemName}\",
    \"searchKey\": \"{first 3 letters}\",
    \"module\": \"${MODULE_ID}\"
  }"
# Repeat for each list item
```

### Table reference (Reference ID `18`)

A table reference points to another table, showing a specific column as display value.

```bash
# 1. Look up the target table:
TABLE_RESP=$(curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/Table?dBTableName={target_table}")
# Save the table ID and name

# 2. Get columns of that table (set _endRow to 200):
COLS_RESP=$(curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/ViewColumn?table=${TABLE_ID}&_endRow=200")
# Ask user which column is the key column and which is the display column

# 3. Create the reference header (parentReference="18" for table type):
HEADER_RESP=$(curl -s -X POST \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/ReferencesHeader" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"{ReferenceName}\",
    \"description\": \"{description}\",
    \"helpComment\": \"{help}\",
    \"parentReference\": \"18\",
    \"module\": \"${MODULE_ID}\"
  }")

# 4. Create the table reference tab with key and display columns:
curl -s -X POST \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/ReferencesTab" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"reference\": \"${HEADER_ID}\",
    \"table\": \"${TABLE_ID}\",
    \"keyColumn\": \"${KEY_COL_ID}\",
    \"displayColumn\": \"${DISPLAY_COL_ID}\"
  }"
```

After creating a reference, remember its header ID — you'll use it as the `referenceID` when creating columns with `CreateColumn` (instead of the standard IDs like `17` or `18`).

## Step 6: Run post-creation sequence

After creating tables, columns, or views, run the mandatory post-creation hooks:

```bash
# 1. TableChecker — detect and register column changes
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CheckTablesColumnHook&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"TableID\": \"${TABLE_ID}\"}"

# 2. SyncTerms — synchronize terms/translations
curl -s -X POST "${ETENDO_URL}/webhooks/?name=SyncTerms&apikey=${API_KEY}" \
  -H "Content-Type: application/json" -d '{}'

# 3. ElementsHandler — correct elements
curl -s -X POST "${ETENDO_URL}/webhooks/?name=ElementsHandler&apikey=${API_KEY}" \
  -H "Content-Type: application/json" -d '{}'
```

This sequence is **mandatory** — skipping it leads to inconsistencies in the Application Dictionary (missing element translations, unregistered columns, etc.).

## Step 7: Export to XML

With Tomcat DOWN (important — export.database requires Tomcat stopped):
```bash
./gradlew resources.down
JAVA_HOME={java_home} \
  ./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
# IMPORTANT: bring services back up after export
./gradlew resources.up
```
Wait for containers to be healthy before running smartbuild or other webhook-dependent operations.

## Step 8: Result

```
+ Table {tablename} created and registered in AD

  Columns added: {N}
  Table ID: {ad_table_id}
  Post-creation hooks: TableChecker + SyncTerms + Elements ✓

  Next steps:
    /etendo:window   -> expose the table in the UI
    /etendo:smartbuild -> recompile and deploy
```
