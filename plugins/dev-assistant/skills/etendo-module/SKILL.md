---
description: "/etendo:module — Create or configure an Etendo module"
argument-hint: "[create | info | module java package]"
---

# /etendo:module — Create or configure an Etendo module

**Arguments:** `$ARGUMENTS` (optional: `create`, `info`, or module java package)

---

First, read `skills/etendo-_context/SKILL.md`.
Also read `docs/application-dictionary.md` for the XML structure reference.

A **module** in Etendo is the unit of deployment. All custom tables, windows, Java code, and configurations belong to a module. Modules are identified by a Java package name (e.g. `com.mycompany.mymodule`) and a DB prefix (e.g. `MYMOD`).

## Headless REST endpoints (complement to webhooks)

These EtendoRX headless endpoints provide read/query capabilities and some creation operations. Use them for **validation before creation** and for **info/search** operations. The base URL is `{ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/`.

| Endpoint | Methods | Use for |
|---|---|---|
| `moduleHeader` | GET, POST, PUT | Search modules by name/javapackage, create module header |
| `moduleDBPrefix` | GET, POST, PUT | Check if a DB prefix exists, create prefix |
| `moduleDependency` | GET, POST, PUT | List/add dependencies |
| `moduleDataPackage` | GET, POST, PUT | Create the data package entry (no webhook equivalent) |

All endpoints require Bearer token authentication:
```bash
ETENDO_TOKEN="..."  # From context or Etendo login
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/moduleHeader?javaPackage=com.example.mymod"
```

> **Strategy**: Use webhooks (`CreateModule`, `AddModuleDependency`) as the primary creation method because they handle internal logic (triggers, validation). Use headless endpoints for pre-creation checks and for the Data Package step (which has no webhook).

## Step 1: Determine operation

Based on `$ARGUMENTS`:
- `create` or blank -> create a new module
- `info` or `{javapackage}` -> show info about an existing module
- Natural language description -> infer intent

For **info**: search by name, javapackage, or DB prefix.

**Via headless (preferred if Tomcat is running):**
```bash
# Search by javapackage:
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/moduleHeader?javaPackage={javapackage}"

# Search by name (partial match):
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/moduleHeader?name={name}"

# Search by DB prefix:
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/moduleDBPrefix?name={PREFIX}"
```

**Via SQL (fallback):**
```sql
SELECT m.javapackage, m.name, m.version, m.isindevelopment,
       p.name AS dbprefix
FROM ad_module m
LEFT JOIN ad_module_dbprefix p ON p.ad_module_id = m.ad_module_id
WHERE m.javapackage = '{module}' OR m.name ILIKE '%{args}%'
      OR p.name ILIKE '%{args}%'
ORDER BY m.name;
```

## Step 2: Gather information (for create)

Ask conversationally, with smart defaults:

| Field | Ask | Default / Suggestion |
|---|---|---|
| Java package | Yes | `com.{company}.{modulename}` |
| Module name | Yes | Title case of package last segment |
| DB prefix | Yes | Uppercase abbreviation, e.g. `MYMOD` — must be unique |
| Description | Optional | Infer from module name if not provided |
| Version | Default | `1.0.0` |
| Dependencies | Ask | "Does this module extend another? (e.g. com.etendoerp.etendorx)" |

**DB prefix rules:** Must be **3 to 7 uppercase letters only**. No numbers, no special characters. Examples: `MYMOD`, `COPDEV`, `SMFT`. Never exceed 7 characters.

### Pre-creation validations

Before creating anything, verify both javapackage and DB prefix are available. Use headless endpoints if Tomcat is running, or SQL otherwise:

**Check javapackage uniqueness (headless):**
```bash
EXISTING=$(curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/moduleHeader?javaPackage={javapackage}")
# If results found, the javapackage is taken
```
If taken, suggest `{javapackage}.new` or ask the user for an alternative.

**Check javapackage uniqueness (SQL fallback):**
```sql
SELECT ad_module_id, name FROM ad_module WHERE javapackage = '{javapackage}';
```

**Check DB prefix uniqueness (headless):**
```bash
EXISTING=$(curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/moduleDBPrefix?name={PREFIX}")
# If results found, the prefix is taken
```

**Check DB prefix uniqueness (SQL fallback):**
```sql
SELECT name FROM ad_module_dbprefix WHERE UPPER(name) = UPPER('{prefix}');
```
If taken, suggest alternatives (e.g., add a letter: `MYMOD` → `MYMODA`).

> **Important**: When searching modules and getting multiple results, always show the list and ask the user to pick the correct one. Module configurations are sensitive — never auto-select ambiguous matches.

## Step 3: Create directory structure

```
modules/{javapackage}/
  build.gradle                          <- minimal module build file
  src/
    {com/mycompany/mymodule}/           <- Java source root (empty initially)
  src-db/
    database/
      model/
        tables/                         <- table XML definitions (alter.database reads this)
      sourcedata/
        AD_MODULE.xml
        AD_MODULE_DEPENDENCY.xml
        AD_MODULE_DBPREFIX.xml
        AD_MODULE_DATAPACKAGE.xml
```

Create all directories and generate the XML files from templates.

**`AD_MODULE.xml`:**
```xml
<?xml version='1.0' encoding='UTF-8'?>
<data>
<!--{UUID}--><AD_MODULE>
<!--{UUID}-->  <AD_MODULE_ID><![CDATA[{UUID}]]></AD_MODULE_ID>
<!--{UUID}-->  <AD_CLIENT_ID><![CDATA[0]]></AD_CLIENT_ID>
<!--{UUID}-->  <AD_ORG_ID><![CDATA[0]]></AD_ORG_ID>
<!--{UUID}-->  <ISACTIVE><![CDATA[Y]]></ISACTIVE>
<!--{UUID}-->  <NAME><![CDATA[{name}]]></NAME>
<!--{UUID}-->  <VERSION><![CDATA[1.0.0]]></VERSION>
<!--{UUID}-->  <DESCRIPTION><![CDATA[{description}]]></DESCRIPTION>
<!--{UUID}-->  <JAVAPACKAGE><![CDATA[{javapackage}]]></JAVAPACKAGE>
<!--{UUID}-->  <TYPE><![CDATA[M]]></TYPE>
<!--{UUID}-->  <ISINDEVELOPMENT><![CDATA[Y]]></ISINDEVELOPMENT>
<!--{UUID}-->  <ISTRANSLATIONREQUIRED><![CDATA[N]]></ISTRANSLATIONREQUIRED>
<!--{UUID}-->  <ISREGISTERED><![CDATA[N]]></ISREGISTERED>
<!--{UUID}-->  <HASCHARTOFACCOUNTS><![CDATA[N]]></HASCHARTOFACCOUNTS>
<!--{UUID}-->  <ISTRANSLATIONMODULE><![CDATA[N]]></ISTRANSLATIONMODULE>
<!--{UUID}-->  <LICENSETYPE><![CDATA[ETENDO]]></LICENSETYPE>
<!--{UUID}--></AD_MODULE>
</data>
```

Note: The UUID for AD_MODULE_ID must be generated by the DB (see Step 4), then written back to the XML. This ensures the XML and DB are in sync.

## Step 4: Register in the DB via webhook

Use the `CreateModule` webhook (requires Tomcat running + API key):

```bash
ETENDO_URL=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('etendoUrl','http://localhost:8080/etendo'))")
API_KEY=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('apikey',''))")

RESP=$(curl -s -X POST "${ETENDO_URL}/webhooks/?name=CreateModule&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"Name\": \"{name}\",
    \"JavaPackage\": \"{javapackage}\",
    \"DBPrefix\": \"{PREFIX}\",
    \"Description\": \"{description}\",
    \"Version\": \"1.0.0\"
  }")

MODULE_ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r'ID:\s*([A-F0-9a-f]{32})',r.get('message','')); print(m.group(1) if m else r.get('error','FAILED'))")
echo "Module ID: $MODULE_ID"
```

If Tomcat is not running, fall back to SQL:
```sql
DO $$
DECLARE
  v_module_id TEXT := get_uuid();
  v_prefix_id TEXT := get_uuid();
BEGIN
  INSERT INTO AD_MODULE (AD_MODULE_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE, CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                         NAME, VERSION, DESCRIPTION, JAVAPACKAGE, TYPE, ISINDEVELOPMENT,
                         ISTRANSLATIONREQUIRED, ISREGISTERED, HASCHARTOFACCOUNTS,
                         ISTRANSLATIONMODULE, LICENSETYPE)
  VALUES (v_module_id, '0', '0', 'Y', now(), '0', now(), '0',
          '{name}', '1.0.0', '{description}', '{javapackage}', 'M', 'Y',
          'N', 'N', 'N', 'N', 'ETENDO');
  INSERT INTO AD_MODULE_DBPREFIX (AD_MODULE_DBPREFIX_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE,
                                   CREATED, CREATEDBY, UPDATED, UPDATEDBY, NAME, AD_MODULE_ID)
  VALUES (v_prefix_id, '0', '0', 'Y', now(), '0', now(), '0', '{PREFIX}', v_module_id);
  RAISE NOTICE 'MODULE_ID: %', v_module_id;
END $$;
```

Write the captured `MODULE_ID` into the XML files.

**Add dependencies (if specified in Step 2):**

Every module needs at least a dependency on core (`DependsOnModuleID="0"`). Use the `AddModuleDependency` webhook:

```bash
# Dependency on Etendo core (almost always required):
curl -s -X POST "${ETENDO_URL}/webhooks/?name=AddModuleDependency&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"ModuleID\": \"${MODULE_ID}\",
    \"DependsOnModuleID\": \"0\",
    \"FirstVersion\": \"3.0.0\",
    \"Enforcement\": \"MAJOR\"
  }"

# Dependency on another module (e.g., com.etendoerp.etendorx):
curl -s -X POST "${ETENDO_URL}/webhooks/?name=AddModuleDependency&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"ModuleID\": \"${MODULE_ID}\",
    \"DependsOnJavaPackage\": \"{dependency_javapackage}\",
    \"FirstVersion\": \"1.0.0\",
    \"Enforcement\": \"MAJOR\"
  }"
```

If Tomcat is not running, add dependencies via SQL (see `_webhooks` skill for the `AD_MODULE_DEPENDENCY` schema).

**Create the Data Package (required):**

Every module needs a Data Package entry. This has no webhook equivalent — use the headless endpoint:

```bash
curl -s -X POST "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/moduleDataPackage" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"module\": \"${MODULE_ID}\",
    \"javaPackage\": \"{javapackage}.data\"
  }"
```

If Tomcat is not running, fall back to SQL:
```sql
INSERT INTO AD_MODULE_DATAPACKAGE (AD_MODULE_DATAPACKAGE_ID, AD_CLIENT_ID, AD_ORG_ID, ISACTIVE,
                                    CREATED, CREATEDBY, UPDATED, UPDATEDBY,
                                    AD_MODULE_ID, JAVAPACKAGE, NAME)
VALUES (get_uuid(), '0', '0', 'Y', now(), '0', now(), '0',
        '{MODULE_ID}', '{javapackage}.data', '{name} Data Package');
```

## Step 5: Update context

Write to `.etendo/context.json` (see `_context` skill for field definitions):
```json
{
  "module": "{javapackage}",
  "modulePath": "modules/{javapackage}",
  "dbPrefix": "{PREFIX}",
  "etendoUrl": "http://localhost:{port}/{context.name}",
  "apikey": "{existing apikey if available}"
}
```

## Step 6: Register with Gradle (if needed)

If the module should be listed in `build.gradle` dependencies (for JAR mode modules):
Show: "Add this to build.gradle dependencies? `implementation('{group}:{name}:[version]')`"
Only relevant for modules sourced from a repository. For in-development local modules, the `modules/` directory is already scanned automatically.

## Step 7: Confirm

```
+ Module created: {javapackage}
  DB prefix:      {PREFIX}
  Data package:   {javapackage}.data
  Path:           modules/{javapackage}/
  Module ID:      {UUID}

  Context set to this module.

  Next steps:
    /etendo:alter-db  -> create tables for this module
    /etendo:window    -> create windows
    /etendo:smartbuild -> compile and deploy
```
