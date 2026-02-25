# /etendo:alter-db — Create or modify database tables and columns

**Arguments:** `$ARGUMENTS` (optional description of the change, e.g. "add column email to MYMOD_customer")

---

First, read `.claude/commands/etendo/_context.md` and resolve the active module context.

This command manages DB schema changes (CREATE TABLE, ADD COLUMN, ALTER COLUMN) in a way that stays consistent with Etendo's Application Dictionary. The flow is always:

**SQL → execute against DB → export.database → XML updated in repo**

## Step 1: Establish context

Resolve:
- Active module (java package, DB prefix, AD_MODULE_ID)
- DB connection (Docker or local, user, db name)

If active module is not set: ask "Which module does this table belong to?"

## Step 2: Understand the change

If `$ARGUMENTS` describes the change clearly (e.g. "add column email VARCHAR(100) to MYMOD_customer"), use it directly. Otherwise, ask conversationally:

**What type of change?**
1. Create a new table
2. Add column to existing table
3. Modify column (type, size, nullable)
4. Add index
5. Drop column (confirm carefully — destructive)

Then ask only what's needed:
- **New table**: name (suggest `{DBPREFIX}_tablename` format), columns list
- **Add column**: table name, column name, type, nullable, default
- **Modify column**: table name, column name, what changes

**For new tables, always include the mandatory Etendo base columns:**
```sql
{DBPREFIX}_tablename_id  VARCHAR(32)  PRIMARY KEY
ad_client_id             VARCHAR(32)  NOT NULL
ad_org_id                VARCHAR(32)  NOT NULL
isactive                 CHAR(1)      NOT NULL DEFAULT 'Y'
created                  TIMESTAMP    NOT NULL DEFAULT now()
createdby                VARCHAR(32)  NOT NULL DEFAULT '0'
updated                  TIMESTAMP    NOT NULL DEFAULT now()
updatedby                VARCHAR(32)  NOT NULL DEFAULT '0'
```

## Step 3: Generate and show SQL

Generate the SQL and show it for confirmation before executing:

```sql
-- Example: new table
CREATE TABLE mymod_customer (
  mymod_customer_id  VARCHAR(32)  NOT NULL,
  ad_client_id       VARCHAR(32)  NOT NULL,
  ad_org_id          VARCHAR(32)  NOT NULL,
  isactive           CHAR(1)      NOT NULL DEFAULT 'Y',
  created            TIMESTAMP    NOT NULL DEFAULT now(),
  createdby          VARCHAR(32)  NOT NULL DEFAULT '0',
  updated            TIMESTAMP    NOT NULL DEFAULT now(),
  updatedby          VARCHAR(32)  NOT NULL DEFAULT '0',
  name               VARCHAR(100) NOT NULL,
  email              VARCHAR(200),
  CONSTRAINT mymod_customer_key PRIMARY KEY (mymod_customer_id)
);

-- Example: add column
ALTER TABLE mymod_customer ADD COLUMN phone VARCHAR(30);
```

Show: "I will execute this SQL. Continue? (Y/N)"

## Step 4: Execute SQL

```bash
# Docker DB
echo "{SQL}" | docker exec -i etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid}

# Local DB
echo "{SQL}" | psql -U {bbdd.user} -d {bbdd.sid} -h localhost -p {bbdd.port}
```

Verify execution: check for error output, confirm with a SELECT or `\d tablename`.

## Step 5: Register in Application Dictionary

For **new tables**: also insert into `AD_TABLE` and `AD_COLUMN` so the AD knows about it:
```sql
DO $$
DECLARE
  v_table_id TEXT := REPLACE(gen_random_uuid()::text, '-', '');
  v_module_id TEXT := '{AD_MODULE_ID}';
BEGIN
  INSERT INTO AD_TABLE (AD_TABLE_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                        NAME, TABLENAME, AD_MODULE_ID, ACCESSLEVEL, REPLICATIONTYPE, ISFULLYQUALIFIEDQUERY, ISVIEW)
  VALUES (v_table_id, '0', '0', 'Y', now(), '0', now(), '0',
          '{TableClassName}', '{tablename}', v_module_id, '3', 'L', 'N', 'N');
  -- AD_COLUMN entries for each column...
END $$;
```

For **new columns**: insert into `AD_COLUMN` linking to the existing `AD_TABLE_ID`.

Ask if they want to add AD_FIELD entries (to show the column in a Tab) or if they'll do that via `/etendo:window`.

## Step 6: Export to XML

```bash
./gradlew export.database -Dmodule={javapackage}
```

This regenerates the XML files in `modules/{javapackage}/src-db/database/sourcedata/`. Show which files were updated.

## Step 7: Next steps

```
✓ Schema change applied and exported to XML

  Modified files:
    modules/{module}/src-db/database/sourcedata/AD_TABLE.xml
    modules/{module}/src-db/database/sourcedata/AD_COLUMN.xml

  Next:
    /etendo:smartbuild   → to regenerate Java entities and deploy
    /etendo:window       → to expose this table in the UI
```
