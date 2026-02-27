---
description: "/etendo:alter-db — Create or modify tables and columns in the Etendo Application Dictionary via webhooks"
argument-hint: "<description, e.g. 'create table SMFT_customer with name and email'>"
---

# /etendo:alter-db — Create or modify tables and columns

**Arguments:** `$ARGUMENTS` (optional description, e.g., "create table SMFT_customer with name and email")

---

First, read `skills/etendo-_context/SKILL.md` and `skills/etendo-_webhooks/SKILL.md`.

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
3. Modify column — type, size, nullable (manual SQL — no webhook available)
4. Add index (manual SQL — no webhook available)
5. Delete column (manual SQL — destructive, confirm first)

For **new table**: ask for name (suggest `{PREFIX}_tablename`), list of columns.
For **new column**: table, name, type, nullable, default.

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

## Step 6: Export to XML

With Tomcat DOWN (important):
```bash
./gradlew resources.down
JAVA_HOME={java_home_path} \
  ./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
./gradlew resources.up
```

## Step 7: Result

```
+ Table {tablename} created and registered in AD

  Columns added: {N}
  Table ID: {ad_table_id}

  Next steps:
    /etendo:window   -> expose the table in the UI
    /etendo:smartbuild -> recompile and deploy
```
