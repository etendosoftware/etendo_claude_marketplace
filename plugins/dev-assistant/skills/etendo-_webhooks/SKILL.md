---
description: "Etendo Webhooks — Shared Helper. Internal reference read by all /etendo:* skills to invoke AD operations via HTTP webhooks instead of manual SQL."
---

# Etendo Webhooks — Shared Helper

This file is NOT a user-facing command. It is read by `/etendo:*` skills to invoke AD operations via HTTP webhooks instead of manual SQL.

For known bugs and workarounds, see `references/known-bugs-*.md`.

---

## When to use webhooks vs SQL

| Task | Use |
|---|---|
| Create module (AD_MODULE + prefix + package) | Webhook `CreateModule` |
| Create template (AD_MODULE type T, no prefix) | Direct SQL (CreateModule fails for templates — see note) |
| Add dependency between modules | Webhook `AddModuleDependency` |
| Create table + register in AD | Webhook `CreateAndRegisterTable` |
| Create DB view and register in AD | Webhook `CreateView` |
| Add column to own or standard table | Webhook `CreateColumn` |
| Create list reference (dropdown) | Webhook `CreateReference` |
| Assign referenceValueID to existing column | SQL: `UPDATE ad_column SET ad_reference_value_id=... WHERE ...` |
| Create window + menu | Webhook `RegisterWindow` |
| Create tab | Webhook `RegisterTab` |
| Register fields for a tab | Webhook `RegisterFields` |
| Register background process | Webhook `RegisterBGProcessWebHook` |
| Register Action Process (launchable from menu) | Webhook `ProcessDefinitionButton` |
| Register Jasper report | Webhook `ProcessDefinitionJasper` |
| Register headless EtendoRX endpoint | Webhook `RegisterHeadlessEndpoint` |
| Register physical columns in AD_COLUMN | Webhook `RegisterColumns` |
| Register new webhook in DB | Webhook `RegisterNewWebHook` |
| Tab filter (Where Clause) | Webhook `SetTabFilter` |
| Computed column (SQL expression) | Webhook `CreateComputedColumn` |
| Add physical FK in PostgreSQL | SQL: `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...` |
| Add field to existing Field Group | Direct SQL (no webhook available) |
| Rename window/tab/menu | SQL: `UPDATE ad_window/ad_tab/ad_menu SET name=...` |

---

## Prerequisite: API Key

Webhooks require API key authentication. Before any call, ensure you have a key available:

### Verify / create API key

```bash
# Check if it already exists in context.json
cat .etendo/context.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('apikey',''))" 2>/dev/null

# If it doesn't exist, create a token AND grant access to all webhooks in one block:
NEW_KEY=$(docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c "
  INSERT INTO smfwhe_definedwebhook_token
    (smfwhe_definedwebhook_token_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, ad_user_roles_id, name, apikey)
  SELECT get_uuid(), '0', '0', 'Y', now(), '0', now(), '0',
    (SELECT ad_user_roles_id FROM ad_user_roles WHERE ad_user_id = (SELECT ad_user_id FROM ad_user WHERE username='admin') LIMIT 1),
    'claude-agent',
    'claude-etendo-key-' || get_uuid()
  RETURNING apikey;
" | tr -d ' ')
echo "KEY: $NEW_KEY"

# CRITICAL: Access is controlled by smfwhe_definedwebhook_ACC (token+webhook), NOT by role.
# The table smfwhe_definedwebhook_role is NOT sufficient — smfwhe_definedwebhook_acc is needed.
# After creating the token, grant access to all webhooks:
TOKEN_ID=$(docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c "
  SELECT smfwhe_definedwebhook_token_id FROM smfwhe_definedwebhook_token WHERE name='claude-agent';
" | tr -d ' ')

docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c "
  INSERT INTO smfwhe_definedwebhook_acc
    (smfwhe_definedwebhook_acc_id, ad_client_id, ad_org_id, isactive, created, createdby, updated, updatedby, smfwhe_definedwebhook_id, smfwhe_definedwebhook_token_id)
  SELECT get_uuid(), '0', '0', 'Y', now(), '0', now(), '0', dw.smfwhe_definedwebhook_id, '${TOKEN_ID}'
  FROM smfwhe_definedwebhook dw
  WHERE NOT EXISTS (
    SELECT 1 FROM smfwhe_definedwebhook_acc a
    WHERE a.smfwhe_definedwebhook_id = dw.smfwhe_definedwebhook_id
      AND a.smfwhe_definedwebhook_token_id = '${TOKEN_ID}'
  );
"
```

Save the key in `.etendo/context.json`:
```json
{
  "module": "...",
  "apikey": "claude-etendo-key-XXXXXXXX"
}
```

> **Note:** If a new webhook is later registered via `RegisterNewWebHook`, that new webhook
> won't have an entry in `smfwhe_definedwebhook_acc`. Repeat the INSERT with `WHERE NOT EXISTS`.

---

## Invocation pattern

**ALWAYS use POST with JSON body.** The webhook uses `?name=` for routing, and all parameters go in the JSON body.

> **Parameter casing matters.** Most webhooks use PascalCase (`ModuleID`, `Name`, `DBPrefix`).
> The exception is `CreateColumn`, which uses camelCase (`tableID`, `columnNameDB`, `moduleID`, `canBeNull`).
> Using the wrong case causes silent failures — always copy parameter names exactly from the examples below.

```bash
ETENDO_URL="http://localhost:8080/etendo"
API_KEY="{apikey from context.json}"

curl -s -X POST "${ETENDO_URL}/webhooks/?name={WebhookName}&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"Param1":"Value1","Param2":"Value2"}'
```

The response is JSON: `{"message":"..."}` on success, `{"error":"..."}` on failure.

**Verify success:**
```bash
RESP=$(curl -s ...)
echo $RESP | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('message') or r.get('error','?'))"
```

---

## Available webhooks and their parameters

### `CreateModule`
Creates AD_MODULE + AD_MODULE_DBPREFIX + AD_PACKAGE in a single call.

> **Templates (Type=T) cannot have a DB prefix** — the trigger `ad_module_dbprefix_trg` blocks it.
> Use direct SQL for templates (see section below).

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateModule&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "Tutorial Module",
    "JavaPackage": "com.smf.tutorial",
    "DBPrefix": "SMFT",
    "Description": "Tutorial module",
    "Version": "1.0.0"
  }')
MODULE_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
echo "Module ID: $MODULE_ID"
```

**Required parameters:** `Name`, `JavaPackage`, `DBPrefix`
**Optional:** `Description` (default=Name), `Version` (default=1.0.0), `Author`, `Type` (M/T/P, default=M)

Response: `{"message": "Module created successfully with ID: <32-char-hex>"}`

#### Create template via SQL (because CreateModule fails for Type=T with DBPrefix)

```bash
cat > /tmp/create_template.sql << 'EOF'
DO $$
DECLARE
  v_module_id TEXT := get_uuid();
  v_dep_id TEXT := get_uuid();
  v_tutorial_id TEXT := '{MODULE_ID_OF_BASE_MODULE}';
BEGIN
  INSERT INTO AD_MODULE (AD_MODULE_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                         NAME, VERSION, DESCRIPTION, JAVAPACKAGE, TYPE, ISINDEVELOPMENT,
                         ISTRANSLATIONREQUIRED, ISREGISTERED, HASCHARTOFACCOUNTS,
                         ISTRANSLATIONMODULE, LICENSETYPE)
  VALUES (v_module_id, '0', '0', 'Y', now(), '0', now(), '0',
          '{Template Name}', '1.0.0', '{description}', '{com.smf.tutorial.template}', 'T', 'Y',
          'N', 'N', 'N', 'N', 'ETENDO');

  -- Dependency with ISINCLUDED=Y (module included in the template)
  INSERT INTO AD_MODULE_DEPENDENCY (AD_MODULE_DEPENDENCY_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE,
                                     CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                                     AD_MODULE_ID, AD_DEPENDENT_MODULE_ID, DEPENDANT_MODULE_NAME,
                                     ISINCLUDED, STARTVERSION, DEPENDENCY_ENFORCEMENT)
  VALUES (v_dep_id, '0', '0', 'Y', now(), '0', now(), '0',
          v_module_id, v_tutorial_id, '{Tutorial Module}', 'Y', '1.0.0', 'MAJOR');

  RAISE NOTICE 'Template ID: %', v_module_id;
END $$;
EOF
docker cp /tmp/create_template.sql etendo-db-1:/tmp/create_template.sql
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -f /tmp/create_template.sql
```

> **Actual columns of AD_MODULE_DEPENDENCY**: `startversion` (NOT NULL), `dependency_enforcement` (with underscore), `isincluded`.
> There is no `dependencyenforcement` as one word — use `dependency_enforcement`.

---

### `AddModuleDependency`
Adds a dependency between two modules.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=AddModuleDependency&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "ModuleID": "'${MODULE_ID}'",
    "DependsOnModuleID": "0",
    "FirstVersion": "3.0.0"
  }'
```

**Required parameters:** `ModuleID`, and one of: `DependsOnModuleID` | `DependsOnJavaPackage`
**Optional:** `FirstVersion`, `LastVersion`, `IsIncluded` ("true"/"false"), `Enforcement` ("MAJOR"/"MINOR"/"NONE")

> `DependsOnModuleID="0"` → core (org.openbravo, the Etendo base module)

---

### `CreateAndRegisterTable`
Creates the physical table in PostgreSQL AND registers it in AD_TABLE with base columns (id, client, org, active, created, updated).

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateAndRegisterTable&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Name": "Subject",
    "DBTableName": "SMFT_Subject",
    "ModuleID": "'${MODULE_ID}'",
    "DataAccessLevel": "3",
    "Description": "Subjects table",
    "Help": "Subjects table",
    "JavaClass": "com.smf.tutorial.data.Subject"
  }')
TABLE_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
```

**Required parameters:** `Name`, `DBTableName`, `ModuleID`, `DataAccessLevel`, `Description`, `Help`, `JavaClass`
**DataAccessLevel:** `3`=System/Org, `4`=Client/Org, `1`=Org

Response: `{"message": "Table registered successfully in Etendo with the ID: '<id>'."}`
The ID comes wrapped in single quotes.

---

### `CreateColumn`
Adds a column to an existing table (physical in PostgreSQL + registration in AD_COLUMN).

> **Parameters in camelCase** — NOT uppercase like other webhooks.
> **`canBeNull`** accepts `"true"`/`"false"` (not `"Y"`/`"N"`).
> **Columns on core tables** (M_Product, C_BPartner, etc.) get the `EM_{PREFIX}_` prefix automatically.
>   Pass the name WITHOUT the module prefix: `"columnNameDB": "Is_Course"` → creates `EM_SMFT_Is_Course`.
> **`referenceValueID` is not supported** — for list columns, create with `referenceID=10` and update
>   `ad_reference_value_id` via SQL afterwards.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateColumn&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "tableID": "'${TABLE_ID}'",
    "columnNameDB": "column_name",
    "name": "Visible Name",
    "referenceID": "10",
    "moduleID": "'${MODULE_ID}'",
    "canBeNull": "true",
    "defaultValue": ""
  }'
```

**Required parameters:** `tableID`, `columnNameDB`, `name`, `referenceID`, `moduleID`, `canBeNull`
**Optional:** `defaultValue`

**Most common Reference IDs:**
| ID | Type | SQL type |
|---|---|---|
| `10` | String | VARCHAR(60) default, webhook creates VARCHAR(200) |
| `14` | Text (long) | TEXT |
| `11` | Integer | NUMERIC(10,0) |
| `22` | Amount/Number | NUMERIC(19,2) |
| `15` | Date | TIMESTAMP |
| `20` | Yes/No (boolean) | CHAR(1) |
| `17` | List (closed reference) | VARCHAR(60) |
| `19` | TableDir (auto FK by name) | VARCHAR(32) |
| `30` | Search (general FK) | VARCHAR(32) |

#### Update referenceValueID via SQL (for List columns):
```bash
cat > /tmp/fix_ref.sql << 'EOF'
UPDATE ad_column
SET ad_reference_id = '17',
    ad_reference_value_id = '{REF_ID}'
WHERE ad_table_id = '{TABLE_ID}' AND LOWER(columnname) = 'type';
EOF
docker cp /tmp/fix_ref.sql etendo-db-1:/tmp/fix_ref.sql
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -f /tmp/fix_ref.sql
```

#### Add physical FKs via SQL:
Physical FKs in the DB are NOT created automatically — the webhook only creates the column.
Column names in the DB are **lowercase** (PostgreSQL normalizes).

```bash
cat > /tmp/add_fks.sql << 'EOF'
ALTER TABLE smft_subject ADD CONSTRAINT smft_subj_teacher_fk
  FOREIGN KEY (teacher) REFERENCES ad_user(ad_user_id);
ALTER TABLE smft_enrollment ADD CONSTRAINT smft_enroll_edition_fk
  FOREIGN KEY (courseedition) REFERENCES smft_course_edition(smft_course_edition_id);
-- etc.
EOF
docker cp /tmp/add_fks.sql etendo-db-1:/tmp/add_fks.sql
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -f /tmp/add_fks.sql
```

---

### `CreateReference`
Creates a List type reference (dropdown) with its items.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateReference&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "NameReference": "SMFT_TeachingType",
    "Prefix": "SMFT",
    "ReferenceList": "Annual,First Semester,Second Semester",
    "Description": "Teaching type for the subject",
    "Help": "Teaching type"
  }'
```

**Required parameters:** `NameReference`, `Prefix`, `ReferenceList` (CSV of names), `Description`, `Help`

> `ReferenceList` is a comma-separated list of **names** (not `value:name`).
> The search key is auto-generated from the first 2 characters of each name (uppercase).
> For custom search keys, update `ad_ref_list` via SQL.

---

### `RegisterWindow`
Creates AD_WINDOW + AD_MENU entry.

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterWindow&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "DBPrefix": "SMFT",
    "Name": "Course",
    "Description": "Course management",
    "HelpComment": "Course management"
  }')
WINDOW_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
echo "Window ID: $WINDOW_ID"
```

**Required parameters:** `DBPrefix`, `Name`, `Description`, `HelpComment`

---

### `RegisterTab`
Creates an AD_TAB inside a window.

> Tab hierarchy is determined by `TabLevel` + `SequenceNumber`:
> a tab at level N is a child of the last tab at level N-1 before it (by sequence).
> The ID in the response comes wrapped in single quotes: `ID: 'XXXX'`.

```bash
RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterTab&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowID": "'${WINDOW_ID}'",
    "TableName": "SMFT_Subject",
    "DBPrefix": "SMFT",
    "TabLevel": "0",
    "SequenceNumber": "10",
    "Name": "Subject",
    "Description": "Subjects tab",
    "HelpComment": "Subjects tab"
  }')
TAB_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
echo "Tab ID: $TAB_ID"
```

**Required parameters:** `WindowID`, `TableName`, `DBPrefix`, `TabLevel`, `SequenceNumber`, `Description`, `HelpComment`
**Optional:** `Name` (default=TableName), `IsReadOnly` ("true"/"false")

---

### `SetTabFilter`
Sets a SQL/HQL filter on an existing tab.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=SetTabFilter&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "TabID": "'${TAB_ID}'",
    "WhereClause": "e.iscourse='\''Y'\''",
    "HQLWhereClause": "as e where e.course = '\''Y'\''",
    "OrderByClause": "name"
  }'
```

**Required parameters:** `TabID`, `WhereClause`
**Optional:** `HQLWhereClause`, `OrderByClause`

---

### `RegisterFields`
Auto-creates AD_FIELD for all columns of a tab.

> `Description` and `HelpComment` are mandatory.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterFields&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "WindowTabID": "'${TAB_ID}'",
    "DBPrefix": "SMFT",
    "Description": "Tab description",
    "HelpComment": "Tab description"
  }'
```

---

### `RegisterBGProcessWebHook`
Registers a Background Process in AD_PROCESS.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterBGProcessWebHook&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Javapackage": "com.smf.tutorial",
    "Name": "Expire Enrollments",
    "SearchKey": "SMFT_ExpireEnrollments",
    "Description": "Marks past-due enrollments as expired",
    "PreventConcurrent": "true"
  }'
```

---

### `ProcessDefinitionButton`
Registers an Action Process (launchable from menu or button) in AD_PROCESS.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=ProcessDefinitionButton&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Prefix": "SMFT",
    "SearchKey": "SMFT_EnrollStudent",
    "ProcessName": "Enroll Student",
    "Description": "Enrolls a student in a course",
    "HelpComment": "Enrolls a student in a course",
    "JavaPackage": "com.smf.tutorial",
    "Parameters": "[{\"BD_NAME\":\"p_student\",\"NAME\":\"Student\",\"LENGTH\":\"32\",\"SEQNO\":\"10\",\"REFERENCE\":\"Search\"},{\"BD_NAME\":\"p_course\",\"NAME\":\"Course\",\"LENGTH\":\"32\",\"SEQNO\":\"20\",\"REFERENCE\":\"Search\"},{\"BD_NAME\":\"p_date\",\"NAME\":\"Date\",\"LENGTH\":\"10\",\"SEQNO\":\"30\",\"REFERENCE\":\"Date\"}]"
  }'
```

**`Parameters` field:** JSON array, each item: `BD_NAME`, `NAME`, `LENGTH`, `SEQNO`, `REFERENCE`

---

### `ProcessDefinitionJasper`
Registers a Jasper report in AD_PROCESS.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=ProcessDefinitionJasper&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Prefix": "SMFT",
    "SearchKey": "SMFT_EvaluationReport",
    "ProcessName": "Evaluation Report",
    "Description": "Prints evaluation with questions and answers",
    "HelpComment": "Prints evaluation with questions and answers",
    "JavaPackage": "com.smf.tutorial",
    "JasperFile": "@basedesign/com/smf/tutorial/reports/EvaluationReport.jrxml"
  }'
```

---

### `CreateComputedColumn`
Creates a computed (virtual/transient) column in AD_COLUMN with a SQL expression.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateComputedColumn&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "TableName": "C_BPartner",
    "ColumnName": "smft_first_expiry_course",
    "Name": "First Expiry Course",
    "SQLLogic": "(SELECT p.name FROM m_product p JOIN smft_enrollment e ON e.courseedition IN (SELECT smft_course_edition_id FROM smft_course_edition WHERE course = p.m_product_id) WHERE e.student = C_BPartner.C_BPartner_ID AND e.dateto >= now() ORDER BY e.dateto ASC LIMIT 1)",
    "ModuleID": "'${MODULE_ID}'"
  }'
```

**Required parameters:** `ColumnName`, `Name`, `SQLLogic`, `ModuleID`, and one of: `TableID` | `TableName`
**Optional:** `ReferenceID` (default="10"=String), `Description`

---

### `RegisterHeadlessEndpoint`
Registers an EtendoRX headless endpoint to expose a Tab via REST.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterHeadlessEndpoint&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "RequestName": "MyCourses",
    "ModuleID": "'${MODULE_ID}'",
    "TableName": "smft_course_edition",
    "Description": "REST endpoint for Course Edition records"
  }'
```

**Required parameters:** `RequestName`, `ModuleID`, and one of: `TabID` | `TableName`
**Optional:** `Description`, `Type` (default=R)

---

### `RegisterNewWebHook`
Registers a new webhook (Java class) in the DB. Use after creating the `.java` file.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterNewWebHook&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "Javaclass": "com.smf.tutorial.webhooks.MyWebhook",
    "SearchKey": "MyWebhook",
    "Params": "Param1;Param2;Param3",
    "ModuleJavaPackage": "com.smf.tutorial"
  }'
```

> After registering, grant access to the current token:
> ```bash
> NEW_WH_ID=$(docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c \
>   "SELECT smfwhe_definedwebhook_id FROM smfwhe_definedwebhook WHERE name='MyWebhook';" | tr -d ' ')
> docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
>   "INSERT INTO smfwhe_definedwebhook_acc (smfwhe_definedwebhook_acc_id,ad_client_id,ad_org_id,isactive,created,createdby,updated,updatedby,smfwhe_definedwebhook_id,smfwhe_definedwebhook_token_id) VALUES (get_uuid(),'0','0','Y',now(),'0',now(),'0','${NEW_WH_ID}','${TOKEN_ID}');"
> ```

---

### `RegisterColumns`
Syncs physical columns of a table with AD_COLUMN (equivalent to the "Create Columns from DB" button in the AD).

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=RegisterColumns&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"TableID": "'${TABLE_ID}'"}'
```

---

### `GetWindowTabOrTableInfo`
Queries IDs of existing windows, tabs, or tables without SQL.

```bash
curl -s -X POST "${ETENDO_URL}/webhooks/?name=GetWindowTabOrTableInfo&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"TableName": "SMFT_Subject"}'
```

---

## Complete flow: new module from scratch

```
0. CreateModule              -> module_id
1. AddModuleDependency       -> dependency on core 3.0
2. CreateAndRegisterTable xN -> table_id per table
3. CreateColumn xN           -> columns per table
4. CreateReference           -> dropdown lists (if any)
5. SQL: UPDATE ad_column     -> assign referenceValueID to list columns
6. SQL: ALTER TABLE ADD FK   -> physical FKs (the webhook doesn't create them)
7. RegisterWindow            -> window_id
8. RegisterTab xN            -> tab_id per tab (order: TabLevel 0->1->2)
9. RegisterFields xN         -> fields per tab
10. SetTabFilter             -> WHERE filter on tabs that need it
11. smartbuild               -> compile and deploy
```

---

## Extract IDs from response

Webhooks return the ID in two different formats. Use the correct regex:

| Format | Webhooks |
|---|---|
| `ID: XXXX` (no quotes) | `CreateModule`, `RegisterWindow`, `RegisterBGProcessWebHook`, `ProcessDefinitionButton`, `ProcessDefinitionJasper` |
| `ID: 'XXXX'` (single quotes) | `CreateAndRegisterTable`, `RegisterTab`, `CreateColumn`, `CreateReference` |

```bash
# ID without quotes:
ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")

# ID wrapped in single quotes:
ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID: '([A-F0-9a-f]{32})'\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")

# Universal (handles both formats):
ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID:?\s*'?([A-F0-9a-f]{32})'?\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
```
