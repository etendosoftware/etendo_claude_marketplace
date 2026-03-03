---
description: "/etendo:window — Create or modify a Window in the Etendo Application Dictionary via webhooks"
argument-hint: "[create | alter WindowName | description]"
---

# /etendo:window — Create or modify a Window in the Application Dictionary

**Arguments:** `$ARGUMENTS` (optional: `create`, `alter WindowName`, or description)

---

First, read `skills/etendo-_guidelines/SKILL.md`, `skills/etendo-_context/SKILL.md`, and `skills/etendo-_webhooks/SKILL.md`.

For AD XML structure and window/tab/field patterns, read `references/application-dictionary.md`. For display logic, references, and field-level configuration, read `references/advanced-ad.md`.

A **Window** in Etendo is the UI entry point. It contains Tabs (level 0 = header, 1 = detail, etc.), each Tab maps to a table.

## Headless REST endpoints (complement to webhooks)

| Endpoint | Methods | Use for |
|---|---|---|
| `ModulePrefix` | GET, PUT | Look up module by DB prefix name — returns the module ID in the `module` property (not `id`) |
| `TreeCheck` | GET, PUT | Configure a table as a tree (`"istree": true` — must be boolean, not string) |

Base URL: `{ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/`

## Complete workflow sequence

The correct order for creating a window with tabs is:

1. **Get table IDs** — Look up all tables that will be used via `GetWindowTabOrTableInfo`
2. **SyncTerms** — Synchronize terminology before creating
3. **RegisterWindow** — Create the window + menu entry
4. **RegisterTab** — Create each tab (header first, then children in order)
5. **RegisterFields** — Register fields for each tab
6. **Read Elements** — Use `ElementsHandler` with mode `READ_ELEMENTS` to find elements missing descriptions
7. **Write Elements** — Use `ElementsHandler` with mode `WRITE_ELEMENTS` to fill missing descriptions/help
8. **SyncTerms** — Final synchronization

## Step 1: Context

Resolve:
- Active module (javapackage, DB prefix, AD_MODULE_ID)
- Bearer token available (see `_webhooks` skill)
- Tomcat running (required for webhooks)

## Step 2: Determine operation

- `create` or empty → create new window
- `alter {WindowName}` → modify existing window (use `GetWindowTabOrTableInfo`)
- Natural language → infer intent

**Look up existing elements with `GetWindowTabOrTableInfo`:**
```bash
# Search by keyword (WINDOW, TAB, TABLE, or COLUMN) + name:
curl -s -X POST "${ETENDO_URL}/webhooks/GetWindowTabOrTableInfo" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"Keyword\": \"WINDOW\", \"Name\": \"{WindowName}\"}"
```
If multiple matches are returned, show the list and ask the user to pick the correct one. Try the exact name first; if no results, try the English translation.

## Step 3: Gather information

Ask only what cannot be inferred:

**Window:**
- Name (required) — words separated by spaces, each word capitalized
- Description — auto-generate if not provided. Describes what the window shows.
- HelpComment — auto-generate if not provided. Explains when/why to use the window.

**Tabs:** for each tab:
- Which table? (list module tables or manual entry)
- Level: 0=header (default for the first), 1=detail, 2=subdetail...
- Read-only? (default N)
- WhereClause? (e.g., `em_smft_iscourse='Y'` for filtering)

**Menu:** Add a menu entry? (default yes)

**Naming conventions:**
- In the database: words separated with `_`, all lowercase (e.g., `smft_course_edition`)
- In the Application Dictionary: words separated by spaces, each word capitalized (e.g., `Course Edition`)
- All AD configuration (names, help texts, descriptions) must be in English, even if the user speaks another language

Confirm everything together before executing.

## Step 4: Pre-sync terminology

Run SyncTerms before creating the window to ensure all existing terms are up to date:

```bash
# Read from context.json:
ETENDO_URL=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('etendoUrl','http://localhost:8080/etendo'))")
DB_PREFIX=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('dbPrefix',''))")

curl -s -X POST "${ETENDO_URL}/webhooks/SyncTerms" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"CleanTerms": "true"}'
```

## Step 5: Create the window

```bash
# 1. Create window + menu
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/RegisterWindow" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "DBPrefix": "'${DB_PREFIX}'",
    "Name": "{WindowName}",
    "Description": "{description}",
    "HelpComment": "{description}"
  }')
echo $RESP
WINDOW_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else '')")
echo "Window ID: $WINDOW_ID"
```

## Step 6: Create tabs

**Tab hierarchy:** Tabs are linked by `TabLevel` + `SequenceNumber`. A tab at level N is a child of the nearest preceding tab at level N-1 (by sequence). Example:
```
Seq 10, Level 0: Course          (header)
Seq 20, Level 1:   Edition       (child of Course)
Seq 30, Level 2:     Enrollment  (child of Edition)
Seq 40, Level 1:   Subject       (child of Course, sibling of Edition)
```
You can have multiple tabs at level 0 — each one becomes an independent header section. Create tabs in order (level 0 first, then 1, 2...):

```bash
# Create tab
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/RegisterTab" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowID": "'${WINDOW_ID}'",
    "TableName": "{DBTableName}",
    "DBPrefix": "'${DB_PREFIX}'",
    "TabLevel": "{0|1|2...}",
    "SequenceNumber": "{10|20|30...}",
    "Name": "{TabName}",
    "Description": "{description}",
    "HelpComment": "{description}"
  }')
echo $RESP
TAB_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else '')")
echo "Tab ID: $TAB_ID"

# Auto-register all fields for the tab
curl -s -X POST "${ETENDO_URL}/webhooks/RegisterFields" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowTabID": "'${TAB_ID}'",
    "DBPrefix": "'${DB_PREFIX}'",
    "Description": "{description}",
    "HelpComment": "{description}"
  }'
```

Repeat for each tab in the tree.

### Post-registration validation (mandatory)

After `RegisterFields`, run these checks to prevent runtime errors:

```sql
-- 1. Fix fields with NULL or zero displaylength (causes NullPointerException when opening window)
UPDATE ad_field f SET displaylength = c.fieldlength
FROM ad_column c
WHERE f.ad_column_id = c.ad_column_id
  AND f.ad_tab_id = '${TAB_ID}'
  AND (f.displaylength IS NULL OR f.displaylength = 0);

-- 2. Verify ad_table.ad_window_id is set (causes FreeMarker tabView error if NULL)
UPDATE ad_table SET ad_window_id = '${WINDOW_ID}'
WHERE ad_table_id = (SELECT ad_table_id FROM ad_tab WHERE ad_tab_id = '${TAB_ID}')
  AND ad_window_id IS NULL;

-- 3. Verify tab boolean columns are not NULL (causes rendering failures)
UPDATE ad_tab SET
  processing = COALESCE(processing, 'N'),
  importfields = COALESCE(importfields, 'N')
WHERE ad_tab_id = '${TAB_ID}';
```

These validations catch common issues with fields created via webhook or SQL fallback. Run them for **every tab** after `RegisterFields`.

> **Field customization after RegisterFields:** The webhook registers ALL columns as visible and editable.
> Use the following SQL patterns to customize individual fields. No webhook exists for these operations.
>
> ```sql
> -- Lookup a field ID by tab and field name:
> SELECT ad_field_id, name, isdisplayed, isreadonly, seqno
> FROM ad_field WHERE ad_tab_id = '{tab_id}' ORDER BY seqno;
>
> -- Hide a field:
> UPDATE ad_field SET isdisplayed = 'N' WHERE ad_tab_id = '{tab_id}' AND name = '{FieldName}';
>
> -- Show a hidden field:
> UPDATE ad_field SET isdisplayed = 'Y' WHERE ad_tab_id = '{tab_id}' AND name = '{FieldName}';
>
> -- Make a field read-only:
> UPDATE ad_field SET isreadonly = 'Y' WHERE ad_tab_id = '{tab_id}' AND name = '{FieldName}';
>
> -- Change field sequence (display order):
> UPDATE ad_field SET seqno = {N} WHERE ad_tab_id = '{tab_id}' AND name = '{FieldName}';
>
> -- Set display logic (show field conditionally — e.g., only when IsActive='Y'):
> UPDATE ad_field SET displaylogic = '@IsActive@=''Y''' WHERE ad_field_id = '{field_id}';
>
> -- Set read-only logic (make field read-only conditionally):
> UPDATE ad_field SET readonlylogic = '@DocStatus@=''CO''' WHERE ad_field_id = '{field_id}';
>
> -- Set default value for a field:
> UPDATE ad_field SET defaultvalue = 'Y' WHERE ad_field_id = '{field_id}';
>
> -- Assign a field to a Field Group (create field group in AD first if needed):
> UPDATE ad_field SET ad_fieldgroup_id = '{fieldgroup_id}' WHERE ad_field_id = '{field_id}';
>
> -- Look up existing field groups:
> SELECT ad_fieldgroup_id, name FROM ad_fieldgroup WHERE isactive = 'Y' ORDER BY name;
>
> -- Rename a window / tab / menu entry:
> UPDATE ad_window SET name = '{NewName}' WHERE ad_window_id = '{window_id}';
> UPDATE ad_tab    SET name = '{NewName}' WHERE ad_tab_id = '{tab_id}';
> UPDATE ad_menu   SET name = '{NewName}' WHERE ad_menu_id = (
>   SELECT ad_menu_id FROM ad_menu WHERE ad_window_id = '{window_id}' LIMIT 1
> );
> ```
>
> After any SQL field changes, run `export.database` to persist them to XML.

## Step 7: Handle elements (descriptions and help)

After registering all fields, check and fill missing element descriptions. This is important because elements without descriptions appear incomplete in the AD.

```bash
# Get TABLE_ID for each table used in the tabs (from Step 1 GetWindowTabOrTableInfo, or from alter-db):
# TABLE_ID is the AD_TABLE_ID of the table behind the tab.

# 1. Read elements to find which are missing descriptions:
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/ElementsHandler" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"TableID\": \"${TABLE_ID}\", \"Mode\": \"READ_ELEMENTS\"}")
echo $RESP
# Parse the response — it returns a list of columns with their current Description and HelpComment.
# Columns where Description or HelpComment is empty/null need to be filled.

# 2. For each element missing descriptions, write them:
curl -s -X POST "${ETENDO_URL}/webhooks/ElementsHandler" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"Mode\": \"WRITE_ELEMENTS\",
    \"ColumnID\": \"{column_id}\",
    \"Description\": \"{auto-generated description}\",
    \"HelpComment\": \"{auto-generated help}\"
  }"

# 3. Final SyncTerms to apply element changes:
curl -s -X POST "${ETENDO_URL}/webhooks/SyncTerms" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"CleanTerms": "true"}'
```

**Auto-generating descriptions:** The Description should explain what the field stores. The HelpComment should explain how the field is used. Both must be in English and cannot be empty. Example:
- Field "Admission Date": Description = "Stores the date when the patient was admitted" / HelpComment = "Used for tracking treatment timeline and scheduling follow-ups"

## Step 8: WhereClause (if applicable)

If a tab needs a filter (e.g., only show products that are courses), use the `SetTabFilter` webhook:

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/SetTabFilter" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "TabID": "'${TAB_ID}'",
    "WhereClause": "{clause}"
  }'
```

## Step 9: Export to XML

With Tomcat DOWN (important — export.database requires Tomcat stopped):
```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "$JAVA_HOME")
JAVA_HOME=${JAVA_HOME} ./gradlew resources.down
JAVA_HOME=${JAVA_HOME} ./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
# IMPORTANT: bring services back up after export
JAVA_HOME=${JAVA_HOME} ./gradlew resources.up
```
Wait for containers to be healthy before proceeding.

## Step 10: Result

```
+ Window "{name}" created

  Window ID: {id}
  Tabs created: {N}

  To see it in Etendo:
    /etendo:smartbuild -> recompile and deploy
    Then: UI -> refresh -> {name} in the menu
```
