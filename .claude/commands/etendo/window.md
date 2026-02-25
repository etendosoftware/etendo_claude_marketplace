# /etendo:window — Create or modify an Etendo Window in the Application Dictionary

**Arguments:** `$ARGUMENTS` (optional: `create`, `alter WindowName`, or a description)

---

First, read `.claude/commands/etendo/_context.md` and resolve the active module context.
Also read `docs/application-dictionary.md` for the XML structure reference.

A **Window** in Etendo is the main UI entry point. It contains one or more **Tabs**, each mapping to a DB table. Tabs at level 0 are headers; level 1 are detail lines.

The flow is always: **SQL INSERTs → execute → export.database → XML files updated**

## Step 1: Establish context

Resolve active module, DB prefix, AD_MODULE_ID.

If not set, query the DB for available modules:
```sql
SELECT javapackage, name FROM ad_module WHERE isindevelopment = 'Y' ORDER BY name;
```

## Step 2: Determine operation

Based on `$ARGUMENTS`:
- `create` or blank → create a new window
- `alter {WindowName}` → modify an existing window
- Natural language → infer intent

For **alter**: look up the existing window in the DB:
```sql
SELECT w.ad_window_id, w.name, t.ad_tab_id, t.name tab_name, t.tablevel,
       tbl.tablename
FROM ad_window w
JOIN ad_tab t ON t.ad_window_id = w.ad_window_id
JOIN ad_table tbl ON tbl.ad_table_id = t.ad_table_id
WHERE w.ad_module_id = '{AD_MODULE_ID}'
ORDER BY w.name, t.seqno;
```

## Step 3: Gather information (conversational, with smart defaults)

For **create**, ask only what can't be inferred:

**Window:**
- Name: (required, e.g. "My Customers")
- Type: default `M` (Maintain) — only ask if they likely need something else
- Description: optional

**Tabs** — ask for each tab:
- Which DB table? (list tables owned by the module, or allow manual entry)
  ```sql
  SELECT tablename, name FROM ad_table WHERE ad_module_id = '{AD_MODULE_ID}' ORDER BY tablename;
  ```
- Tab name: default = table name in Title Case
- Level: 0 = header (default for first tab), 1 = lines (if they say "it has lines/details")
- Single row view?: default N

**Fields** — offer two options:
1. "Add all columns from the table automatically" → generate AD_FIELD for every AD_COLUMN
2. "Let me specify which columns" → ask for column list

**Menu entry**: ask "Add a menu entry for this window? Where in the menu?" (default: yes, under the module's menu group)

Confirm all at once before generating SQL: show a summary table.

## Step 4: Generate SQL

Generate a complete SQL block using DO $$ ... END $$ with generated UUIDs:

```sql
DO $$
DECLARE
  v_module_id  TEXT := '{AD_MODULE_ID}';
  v_window_id  TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  v_tab_id     TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  v_menu_id    TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  -- one v_field_id per field
BEGIN

  -- Window
  INSERT INTO AD_WINDOW (...) VALUES (...);

  -- Tab(s)
  INSERT INTO AD_TAB (...) VALUES (...);

  -- Fields (for each selected column)
  INSERT INTO AD_FIELD (...) VALUES (...);

  -- Menu entry
  INSERT INTO AD_MENU (...) VALUES (...);

END $$;
```

Show the complete SQL. Ask: "Execute this? (Y/N)"

## Step 5: Execute

```bash
# Docker
echo "{SQL}" | docker exec -i etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid}

# Local
echo "{SQL}" | psql -U {bbdd.user} -d {bbdd.sid} -h localhost -p {bbdd.port}
```

Verify: query the newly created window ID back from DB.

## Step 6: Export to XML

```bash
./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
```

Show which files were updated:
- `AD_WINDOW.xml`
- `AD_TAB.xml`
- `AD_FIELD.xml`
- `AD_MENU.xml`

## Step 7: Deploy

```
✓ Window "{name}" created and exported to XML

  To see it in Etendo:
    /etendo:smartbuild   → recompile and redeploy
    Then: Etendo UI → refresh → {name} should appear in the menu
```
