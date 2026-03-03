# Etendo Application Dictionary (AD) Reference

**Source:** etendo_core XML analysis + module inspection
**Date:** 2026-02-25

---

## Overview

The Application Dictionary (AD) is Etendo's metadata layer. It is the bridge between the physical database and the application.

**Key concept: every physical PostgreSQL table and column must be declared (registered) in the AD for Etendo to know it exists.** A table that exists in PostgreSQL but has no `AD_TABLE` record is completely invisible to the system — it won't generate Java entity classes, can't be used in windows/tabs, and the DAL (ORM) won't touch it.

The flow works like this:

```
Physical DB table (PostgreSQL)
  ↓ registered via
AD_TABLE record (declares the table to Etendo)
  ↓ columns registered via
AD_COLUMN records (declares each column + metadata: type, nullable, reference, etc.)
  ↓ generates
Java entity class (DAL/ORM — via generate.entities)
  ↓ exposed in UI via
AD_WINDOW → AD_TAB → AD_FIELD (windows, tabs, fields)
```

Everything visible in the UI — windows, tabs, fields, menus — is defined as records in the DB and exported to XML files in `src-db/database/sourcedata/`. This is how the ERP is configured without touching Java code.

### Bidirectional sync

- **`export.database`** — reads AD records from the DB and writes them as XML files (DB → XML). Use after creating/modifying AD objects.
- **`update.database`** — reads XML files and applies them to the DB (XML → DB). Use when deploying to another environment or pulling changes.

The DB is the source of truth at **design time**. The XML is the source of truth for **distribution**.

---

## Key XML Files (per module)

Located at: `modules/{javapackage}/src-db/database/sourcedata/`

| File | AD Table | Purpose |
|---|---|---|
| `AD_MODULE.xml` | AD_MODULE | Module identity (name, version, description) |
| `AD_MODULE_DEPENDENCY.xml` | AD_MODULE_DEPENDENCY | Dependencies on other modules |
| `AD_MODULE_DBPREFIX.xml` | AD_MODULE_DBPREFIX | Maps DB object prefix to module |
| `AD_TABLE.xml` | AD_TABLE | Custom tables owned by this module |
| `AD_COLUMN.xml` | AD_COLUMN | Custom columns (in module tables or extensions) |
| `AD_WINDOW.xml` | AD_WINDOW | Windows (entry points in the menu) |
| `AD_TAB.xml` | AD_TAB | Tabs inside windows (map to DB tables) |
| `AD_FIELD.xml` | AD_FIELD | Fields shown in each tab |
| `AD_MENU.xml` | AD_MENU | Menu entries pointing to windows |
| `AD_ELEMENT.xml` | AD_ELEMENT | Reusable field labels/help texts |

---

## UUID Format

All IDs in Etendo are 32-char uppercase hex UUIDs (no dashes):
```sql
-- Generate in PostgreSQL:
REPLACE(gen_random_uuid()::text, '-', '')
-- Example: 'BC7B2F721FD249F5A360C6AAD2A7EBF7'
```

Never pre-generate UUIDs in application code — always let the DB generate them in the INSERT.

---

## Common Fixed Values

| Field | Value | Meaning |
|---|---|---|
| `AD_CLIENT_ID` | `0` | System client (module-level objects) |
| `AD_ORG_ID` | `0` | System org |
| `ISACTIVE` | `Y` | Active record |
| `CREATEDBY` / `UPDATEDBY` | `0` | System user |

---

## AD_MODULE Structure

```xml
<AD_MODULE>
  <AD_MODULE_ID><![CDATA[{UUID}]]></AD_MODULE_ID>
  <AD_CLIENT_ID><![CDATA[0]]></AD_CLIENT_ID>
  <AD_ORG_ID><![CDATA[0]]></AD_ORG_ID>
  <ISACTIVE><![CDATA[Y]]></ISACTIVE>
  <NAME><![CDATA[My Module Name]]></NAME>
  <VERSION><![CDATA[1.0.0]]></VERSION>
  <DESCRIPTION><![CDATA[Description]]></DESCRIPTION>
  <JAVAPACKAGE><![CDATA[com.mycompany.mymodule]]></JAVAPACKAGE>
  <TYPE><![CDATA[M]]></TYPE>           <!-- M=Module, T=Template, P=Pack -->
  <ISINDEVELOPMENT><![CDATA[Y]]></ISINDEVELOPMENT>
  <ISTRANSLATIONREQUIRED><![CDATA[N]]></ISTRANSLATIONREQUIRED>
  <ISREGISTERED><![CDATA[N]]></ISREGISTERED>
  <HASCHARTOFACCOUNTS><![CDATA[N]]></HASCHARTOFACCOUNTS>
  <ISTRANSLATIONMODULE><![CDATA[N]]></ISTRANSLATIONMODULE>
  <LICENSETYPE><![CDATA[ETENDO]]></LICENSETYPE>
</AD_MODULE>
```

---

## AD_MODULE_DBPREFIX Structure

```xml
<AD_MODULE_DBPREFIX>
  <AD_MODULE_DBPREFIX_ID><![CDATA[{UUID}]]></AD_MODULE_DBPREFIX_ID>
  <AD_CLIENT_ID><![CDATA[0]]></AD_CLIENT_ID>
  <AD_ORG_ID><![CDATA[0]]></AD_ORG_ID>
  <ISACTIVE><![CDATA[Y]]></ISACTIVE>
  <NAME><![CDATA[MYMOD]]></NAME>         <!-- The prefix, e.g. MYMOD_ -->
  <AD_MODULE_ID><![CDATA[{module_UUID}]]></AD_MODULE_ID>
</AD_MODULE_DBPREFIX>
```

**Convention:** DB prefix is uppercase, 3-8 chars. Tables and columns in this module are named `MYMOD_tablename`, `MYMOD_columnname`.

---

## AD_WINDOW Structure

```xml
<AD_WINDOW>
  <AD_WINDOW_ID><![CDATA[{UUID}]]></AD_WINDOW_ID>
  <AD_CLIENT_ID><![CDATA[0]]></AD_CLIENT_ID>
  <AD_ORG_ID><![CDATA[0]]></AD_ORG_ID>
  <ISACTIVE><![CDATA[Y]]></ISACTIVE>
  <NAME><![CDATA[My Window Name]]></NAME>
  <WINDOWTYPE><![CDATA[M]]></WINDOWTYPE>    <!-- M=Maintain -->
  <ISSOTRX><![CDATA[Y]]></ISSOTRX>
  <PROCESSING><![CDATA[N]]></PROCESSING>
  <ISDEFAULT><![CDATA[N]]></ISDEFAULT>
  <AD_MODULE_ID><![CDATA[{module_UUID}]]></AD_MODULE_ID>
  <ISTHREADSAFE><![CDATA[N]]></ISTHREADSAFE>
  <ISADVANCEDFEATURE><![CDATA[N]]></ISADVANCEDFEATURE>
</AD_WINDOW>
```

Window types: `M` (Maintain), `T` (Transaction), `Q` (Query Only)

---

## AD_TAB Structure

```xml
<AD_TAB>
  <AD_TAB_ID><![CDATA[{UUID}]]></AD_TAB_ID>
  <AD_CLIENT_ID><![CDATA[0]]></AD_CLIENT_ID>
  <AD_ORG_ID><![CDATA[0]]></AD_ORG_ID>
  <ISACTIVE><![CDATA[Y]]></ISACTIVE>
  <NAME><![CDATA[Tab Name]]></NAME>
  <AD_TABLE_ID><![CDATA[{table_UUID}]]></AD_TABLE_ID>
  <AD_WINDOW_ID><![CDATA[{window_UUID}]]></AD_WINDOW_ID>
  <SEQNO><![CDATA[10]]></SEQNO>           <!-- Tab order: 10, 20, 30 -->
  <TABLEVEL><![CDATA[0]]></TABLEVEL>       <!-- 0=header, 1=line, 2=sub-line -->
  <ISSINGLEROW><![CDATA[N]]></ISSINGLEROW>
  <ISINFOTAB><![CDATA[N]]></ISINFOTAB>
  <ISTRANSLATIONTAB><![CDATA[N]]></ISTRANSLATIONTAB>
  <ISREADONLY><![CDATA[N]]></ISREADONLY>
  <HASTREE><![CDATA[N]]></HASTREE>
  <PROCESSING><![CDATA[N]]></PROCESSING>
  <IMPORTFIELDS><![CDATA[N]]></IMPORTFIELDS>
  <ISSORTTAB><![CDATA[N]]></ISSORTTAB>
  <AD_MODULE_ID><![CDATA[{module_UUID}]]></AD_MODULE_ID>
  <UIPATTERN><![CDATA[STD]]></UIPATTERN>   <!-- STD, RO (read-only), ED (edit) -->
  <SHOWPARENTBUTTONS><![CDATA[Y]]></SHOWPARENTBUTTONS>
  <DISABLE_PARENT_KEY_PROPERTY><![CDATA[N]]></DISABLE_PARENT_KEY_PROPERTY>
  <ISREADONLYTREE><![CDATA[N]]></ISREADONLYTREE>
  <ISSHOWTREENODEICONS><![CDATA[Y]]></ISSHOWTREENODEICONS>
  <EM_OBUIAPP_CAN_ADD><![CDATA[Y]]></EM_OBUIAPP_CAN_ADD>
  <EM_OBUIAPP_CAN_DELETE><![CDATA[Y]]></EM_OBUIAPP_CAN_DELETE>
  <EM_OBUIAPP_SHOW_SELECT><![CDATA[Y]]></EM_OBUIAPP_SHOW_SELECT>
  <EM_OBUIAPP_SHOW_CLONE_BUTTON><![CDATA[N]]></EM_OBUIAPP_SHOW_CLONE_BUTTON>
  <EM_OBUIAPP_CLONE_CHILDREN><![CDATA[Y]]></EM_OBUIAPP_CLONE_CHILDREN>
</AD_TAB>
```

**TABLEVEL**: Determines header/line relationship. Tab with level=0 is the master. Level=1 tabs with the same AD_WINDOW_ID are children (lines).

---

## AD_TABLE — Declaring a physical table

`AD_TABLE` registers a physical PostgreSQL table so Etendo can manage it. Without this record, the table is invisible to the ORM, entity generation, and UI.

- `NAME` — the Java entity class name (PascalCase, e.g. `MYMOD_MyTable`)
- `TABLENAME` — the actual DB table name (lowercase, e.g. `mymod_mytable`)
- `ACCESSLEVEL` — controls which client/org can see data (see `advanced-ad.md`)

```xml
<AD_TABLE>
  <AD_TABLE_ID><![CDATA[{UUID}]]></AD_TABLE_ID>
  <AD_CLIENT_ID><![CDATA[0]]></AD_CLIENT_ID>
  <AD_ORG_ID><![CDATA[0]]></AD_ORG_ID>
  <ISACTIVE><![CDATA[Y]]></ISACTIVE>
  <NAME><![CDATA[MYMOD_MyTable]]></NAME>
  <TABLENAME><![CDATA[mymod_mytable]]></TABLENAME>
  <AD_PACKAGE_ID><![CDATA[{package_UUID}]]></AD_PACKAGE_ID>
  <CLASSNAME><![CDATA[com.mycompany.mymodule.ClassName]]></CLASSNAME>
  <ISVIEW><![CDATA[N]]></ISVIEW>
  <ACCESSLEVEL><![CDATA[3]]></ACCESSLEVEL>   <!-- 1=Org, 3=Client+Org, 6=System+Client, 7=All -->
  <REPLICATIONTYPE><![CDATA[L]]></REPLICATIONTYPE>
  <AD_MODULE_ID><![CDATA[{module_UUID}]]></AD_MODULE_ID>
  <ISFULLYQUALIFIEDQUERY><![CDATA[N]]></ISFULLYQUALIFIEDQUERY>
</AD_TABLE>
```

---

## AD_COLUMN — Declaring a physical column with metadata

`AD_COLUMN` registers a physical column of a table and adds metadata that the physical DB doesn't have: the UI widget type (Reference), whether it's mandatory, default values, validations, etc.

A column that exists in PostgreSQL but has no `AD_COLUMN` record is invisible to Etendo — it won't appear in the generated entity class and can't be used in forms.

- `COLUMNNAME` — must match the physical column name exactly (lowercase)
- `AD_REFERENCE_ID` — the data type / UI widget (see Reference IDs below)
- `ISFIELDONLY` — `Y` if the column has no physical DB column (virtual/property field)

```xml
<AD_COLUMN>
  <AD_COLUMN_ID><![CDATA[{UUID}]]></AD_COLUMN_ID>
  <AD_CLIENT_ID><![CDATA[0]]></AD_CLIENT_ID>
  <AD_ORG_ID><![CDATA[0]]></AD_ORG_ID>
  <ISACTIVE><![CDATA[Y]]></ISACTIVE>
  <NAME><![CDATA[My Column Name]]></NAME>          <!-- Display name -->
  <COLUMNNAME><![CDATA[mymod_mycolumn]]></COLUMNNAME> <!-- Physical DB column -->
  <AD_TABLE_ID><![CDATA[{table_UUID}]]></AD_TABLE_ID>
  <AD_REFERENCE_ID><![CDATA[10]]></AD_REFERENCE_ID>  <!-- 10=String, 20=Integer, etc. -->
  <FIELDLENGTH><![CDATA[255]]></FIELDLENGTH>
  <ISKEY><![CDATA[N]]></ISKEY>
  <ISMANDATORY><![CDATA[N]]></ISMANDATORY>
  <ISUPDATEABLE><![CDATA[Y]]></ISUPDATEABLE>
  <ISIDENTIFIER><![CDATA[N]]></ISIDENTIFIER>
  <SEQNO><![CDATA[10]]></SEQNO>
  <AD_MODULE_ID><![CDATA[{module_UUID}]]></AD_MODULE_ID>
</AD_COLUMN>
```

### Common Reference IDs (AD_REFERENCE_ID)

| ID | Type | DB column type | UI widget |
|---|---|---|---|
| `10` | String | `VARCHAR(n)` | Text input |
| `14` | Text | `TEXT` | Textarea |
| `11` | Integer | `NUMERIC` | Number input |
| `12` | Amount | `NUMERIC` | Number with currency format |
| `22` | Number | `NUMERIC` | Decimal number |
| `15` | Date | `TIMESTAMP` | Date picker |
| `16` | DateTime | `TIMESTAMP` | Date + time picker |
| `20` | Yes/No | `CHAR(1)` | Checkbox (Y/N) |
| `17` | List | `VARCHAR(60)` | Dropdown from fixed values |
| `19` | TableDir | `VARCHAR(32)` | FK dropdown (auto-resolved by column name) |
| `30` | Search | `VARCHAR(32)` | FK with search popup |
| `28` | Button | `CHAR(1)` | Action button (linked to a Process) |

---

## SQL Workflow: Create a Window with a Tab

```sql
DO $$
DECLARE
  v_window_id TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  v_tab_id    TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  v_menu_id   TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  v_module_id TEXT := '<module_UUID>';   -- from AD_MODULE
  v_table_id  TEXT := '<table_UUID>';    -- from AD_TABLE
BEGIN

  -- 1. Window
  INSERT INTO AD_WINDOW (AD_WINDOW_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                         NAME, WINDOWTYPE, ISSOTRX, PROCESSING, ISDEFAULT, AD_MODULE_ID, ISTHREADSAFE, ISADVANCEDFEATURE)
  VALUES (v_window_id, '0', '0', 'Y', now(), '0', now(), '0',
          'My Window', 'M', 'Y', 'N', 'N', v_module_id, 'N', 'N');

  -- 2. Tab (header level 0)
  INSERT INTO AD_TAB (AD_TAB_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                      NAME, AD_TABLE_ID, AD_WINDOW_ID, SEQNO, TABLEVEL, ISSINGLEROW, AD_MODULE_ID, UIPATTERN,
                      ISINFOTAB, ISTRANSLATIONTAB, ISREADONLY, HASTREE, PROCESSING, IMPORTFIELDS, ISSORTTAB,
                      SHOWPARENTBUTTONS, DISABLE_PARENT_KEY_PROPERTY, ISREADONLYTREE, ISSHOWTREENODEICONS,
                      EM_OBUIAPP_CAN_ADD, EM_OBUIAPP_CAN_DELETE, EM_OBUIAPP_SHOW_SELECT,
                      EM_OBUIAPP_SHOW_CLONE_BUTTON, EM_OBUIAPP_CLONE_CHILDREN)
  VALUES (v_tab_id, '0', '0', 'Y', now(), '0', now(), '0',
          'Main Tab', v_table_id, v_window_id, 10, 0, 'N', v_module_id, 'STD',
          'N', 'N', 'N', 'N', 'N', 'N', 'N',
          'Y', 'N', 'N', 'Y',
          'Y', 'Y', 'Y', 'N', 'Y');

  -- 3. Menu entry
  INSERT INTO AD_MENU (AD_MENU_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                       NAME, ISSUMMARY, ACTION, AD_WINDOW_ID, AD_MODULE_ID)
  VALUES (v_menu_id, '0', '0', 'Y', now(), '0', now(), '0',
          'My Window', 'N', 'W', v_window_id, v_module_id);

  -- 4. Link table to window (prevents FreeMarker tabView error)
  UPDATE AD_TABLE SET ad_window_id = v_window_id WHERE ad_table_id = v_table_id AND ad_window_id IS NULL;

END $$;
```

### Important: AD_FIELD.DISPLAYLENGTH

After creating fields (via `RegisterFields` webhook or SQL INSERT), `displaylength` **must not be NULL or 0**. A NULL value causes `NullPointerException` when opening the window. A zero value makes the field uneditable (zero-width input). Always set it to the column's `fieldlength`:

```sql
UPDATE ad_field f SET displaylength = c.fieldlength
FROM ad_column c
WHERE f.ad_column_id = c.ad_column_id
  AND f.ad_tab_id = '{tab_id}'
  AND (f.displaylength IS NULL OR f.displaylength = 0);
```

### Important: AD_COLUMN.FIELDLENGTH

`fieldlength` controls the maximum input length in the UI. A value of `0` makes the field uneditable. Recommended values by reference type:

| Reference | fieldlength |
|---|---|
| String (10) | `60`–`200` |
| Text (14) | `2000`+ |
| Integer (11) / Number (22) | `10` |
| Date (15) / DateTime (16) | `19` |
| Yes/No (20) | `1` |
| List (17) | `60` |
| TableDir (19) / Search (30) | `32` |

---

## export.database After AD Changes

```bash
# Export only the affected module (preferred — faster, safer)
./gradlew export.database -Dmodule=com.mycompany.mymodule

# Full export (slower — use when multiple modules changed)
./gradlew export.database
```

This regenerates all XML files in `modules/{javapackage}/src-db/database/sourcedata/` from the DB state.

---

## EtendoRX Headless AD Objects

For creating headless API endpoints, the relevant tables are:

| Table | Purpose |
|---|---|
| `ETAPI_OPENAPI_REQ` | Defines the endpoint name (URL segment) |
| `ETRX_OPENAPI_TAB` | Maps endpoint to a Tab (and therefore a DB table) |
| `ETRX_ENTITY_FIELD` | Specifies which fields are exposed |
| `ETRX_PROJECTION` | Groups related endpoints (optional, for organization) |

See `references/etendo-headless.md` for the full headless API reference.
