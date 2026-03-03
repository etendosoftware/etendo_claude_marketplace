---
description: "Etendo Dev Assistant — Shared Guidelines. Cross-cutting conventions that apply to ALL /etendo:* skills."
---

# Etendo Dev Assistant — Shared Guidelines

This file is NOT a user-facing command. It is read by all `/etendo:*` skills to ensure consistent behavior across the entire Dev Assistant.

> **Hierarchy of shared files:**
> - `_guidelines` (this file) — conventions, patterns, output format
> - `_context` — project detection, module resolution, DB connection, Gradle tasks
> - `_webhooks` — webhook invocation patterns, specific webhook parameters, ID extraction

---

## 1. Reading context variables

All skills that call webhooks or headless endpoints need these variables. Read them from `.etendo/context.json` at the start of any operation:

```bash
ETENDO_URL=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('etendoUrl','http://localhost:8080/etendo'))")
DB_PREFIX=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('dbPrefix',''))")
MODULE_JP=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('module',''))")
```

Then obtain a Bearer token (required for both webhooks and headless endpoints):
```bash
ETENDO_TOKEN=$(curl -s -X POST "${ETENDO_URL}/sws/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"0"}' \
  | python3 -c "import sys,json; data=json.loads(sys.stdin.buffer.read().decode('utf-8','replace')); print(data.get('token',''))")
```

**MODULE_ID is NOT stored in context.json** — resolve it at runtime:
```bash
MODULE_ID=$(docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c \
  "SELECT ad_module_id FROM ad_module WHERE javapackage = '${MODULE_JP}';" | tr -d ' ')
```

For local DB (when `docker_com.etendoerp.docker_db` is not `true`):
```bash
MODULE_ID=$(psql -U {bbdd.user} -d {bbdd.sid} -h localhost -p {bbdd.port} -t -c \
  "SELECT ad_module_id FROM ad_module WHERE javapackage = '${MODULE_JP}';" | tr -d ' ')
```

---

## 2. JAVA_HOME detection

Gradle requires Java 17. Without the correct JAVA_HOME, builds fail with "Unsupported class file major version". Always detect before running any Gradle command:

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "$JAVA_HOME")
```

Then prefix every Gradle call:
```bash
JAVA_HOME=${JAVA_HOME} ./gradlew {task}
```

---

## 3. Gradle output convention

All `./gradlew` calls redirect output to `/tmp/etendo-{task}.log`. Read the log only on failure — this keeps the console clean and makes error diagnosis easier.

```bash
JAVA_HOME=${JAVA_HOME} ./gradlew smartbuild > /tmp/etendo-smartbuild.log 2>&1
tail -5 /tmp/etendo-smartbuild.log
```

On failure, diagnose with:
```bash
grep -E "ERROR|Exception|FAILED" /tmp/etendo-{task}.log | tail -30
```

Common errors across all Gradle tasks:
| Error | Cause | Fix |
|---|---|---|
| `Unsupported class file major version` | Wrong Java version | Set JAVA_HOME to Java 17 |
| `Connection refused` | DB not running | `./gradlew resources.up` or start PostgreSQL |
| `Authentication failed` | Wrong `bbdd.*` credentials | Check `gradle.properties` |
| `Could not resolve` | Invalid GitHub token | Check `githubToken` in `gradle.properties` |
| `invalid mount path` | `setup` not run before Docker | Run `./gradlew setup` first |
| `OutOfMemoryError` | JVM heap too small | Add `org.gradle.jvmargs=-Xmx4g` to `gradle.properties` |

---

## 4. Export sequence

`export.database` requires Tomcat to be stopped. Always bracket it with `resources.down` / `resources.up`:

```bash
JAVA_HOME=${JAVA_HOME} ./gradlew resources.down
JAVA_HOME=${JAVA_HOME} ./gradlew export.database -Dmodule={javapackage} > /tmp/etendo-export.log 2>&1
tail -5 /tmp/etendo-export.log
# Bring services back up after export:
JAVA_HOME=${JAVA_HOME} ./gradlew resources.up
```

Wait for containers to be healthy before running smartbuild or other webhook-dependent operations.

---

## 5. Naming conventions

These apply everywhere in Etendo development:

| Context | Convention | Example |
|---|---|---|
| **Database** (tables, columns) | Lowercase, words separated by `_` | `smft_course_edition` |
| **Application Dictionary** (window/tab/field names) | Each word capitalized, separated by spaces | `Course Edition` |
| **DB prefix** | 3-7 uppercase letters only, no numbers | `SMFT`, `COPDEV` |
| **Java package** | Lowercase dot-separated, reverse domain | `com.smf.tutorial` |
| **Java class** | PascalCase | `CourseEditionEventHandler` |
| **Search keys** | `{PREFIX}_{DescriptiveName}` in CamelCase | `SMFT_ExpireEnrollments` |

**Language rule:** All Application Dictionary configuration (names, descriptions, help texts) must be in **English**, even if the user communicates in another language. This ensures consistency across translations and avoids encoding issues.

**Extension columns (EM_ prefix):** When a module adds a column to a table owned by a **different** module (not just core tables — any other module), the column name must be prefixed with `EM_{PREFIX}_`. The `CreateColumn` webhook handles this automatically — always pass the column name **without** your module prefix. Example: pass `"Is_Course"`, the webhook creates `EM_SMFT_Is_Course`. TableDir references (ref 19) are not allowed on extension columns — use Search (ref 30) instead. See `alter-db` skill for details.

---

## 6. Webhook parameter casing

Most webhooks use **PascalCase** parameters: `ModuleID`, `Name`, `DBPrefix`, `Description`.

The exception is `CreateColumn`, which uses **camelCase**: `tableID`, `columnNameDB`, `moduleID`, `canBeNull`.

Using the wrong case causes silent failures — always copy parameter names exactly from the examples in `_webhooks`.

---

## 7. ID extraction from webhook responses

Webhooks return IDs in two formats. Use the correct regex (documented in `_webhooks` skill):

```bash
# Universal (handles both formats — recommended):
ID=$(echo $RESP | python3 -c "import sys,json,re; r=json.load(sys.stdin); m=re.search(r\"ID:?\s*'?([A-F0-9a-f]{32})'?\",r.get('message','')); print(m.group(1) if m else r.get('error','FAIL'))")
```

Always check for errors:
```bash
if [ "$ID" = "FAIL" ] || [ -z "$ID" ]; then
  echo "ERROR: $RESP"
  # Stop and diagnose
fi
```

---

## 8. Result / output format

Every skill ends with a result summary using this consistent format:

```
+ {Action verb} {subject}

  {Key detail 1}: {value}
  {Key detail 2}: {value}

  Next steps:
    /etendo:{skill1} -> {what it does}
    /etendo:{skill2} -> {what it does}
```

The `+` prefix signals success. Keep it concise — the summary should fit in a terminal without scrolling.

---

## 9. Confirmation before executing

Always show a plan and ask for confirmation before:
- Creating tables, columns, windows, tabs (AD changes are hard to undo)
- Running `update.database` or `install` (modify the database)
- Running `export.database` (modifies XML files)
- Any destructive operation (DELETE, DROP, etc.)

Exception: read-only operations (queries, status checks, listing) do not need confirmation.

---

## 10. Docker vs local fallbacks

Not all Etendo installations use Docker. When running commands that depend on Docker:

1. Check `gradle.properties` for `docker_com.etendoerp.docker_db=true` and `docker_com.etendoerp.tomcat=true`
2. If Docker DB: `docker exec -i etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid}`
3. If local DB: `psql -U {bbdd.user} -d {bbdd.sid} -h localhost -p {bbdd.port}`
4. If Docker Tomcat: `docker exec etendo-tomcat-1 sh -c 'tail -n 100 /usr/local/tomcat/logs/openbravo.log'`
5. If local Tomcat: `tail -n 100 $CATALINA_HOME/logs/openbravo.log`

---

## 11. SQL execution in Docker

**Never use heredoc** with `docker exec` — it hangs indefinitely.

Correct pattern: write to `/tmp`, copy to container, then execute:
```bash
cat > /tmp/my_script.sql << 'EOF'
SELECT 1;
EOF
docker cp /tmp/my_script.sql etendo-db-1:/tmp/my_script.sql
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -f /tmp/my_script.sql
```

For short single-line queries, inline `-c` is acceptable:
```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c "SELECT 1;"
```

---

## 12. Post-creation hooks (for AD operations)

After creating or modifying tables, columns, or views, run this mandatory sequence:

```bash
# 1. TableChecker — detect column changes
curl -s -X POST "${ETENDO_URL}/webhooks/CheckTablesColumnHook" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"TableID\": \"${TABLE_ID}\"}"

# 2. SyncTerms — synchronize terms
curl -s -X POST "${ETENDO_URL}/webhooks/SyncTerms" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" -d '{}'

# 3. ElementsHandler — auto-correct elements
curl -s -X POST "${ETENDO_URL}/webhooks/ElementsHandler" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"TableID\": \"${TABLE_ID}\", \"Mode\": \"READ_ELEMENTS\"}"
```

Never skip or reorder these steps. See `alter-db` and `window` skills for full details.

**AD_ELEMENT sync:** The `CreateColumn` webhook creates the physical column + `AD_COLUMN` + `AD_ELEMENT` in one call. But if columns were created directly via SQL (`ALTER TABLE ADD COLUMN`), only the physical column exists. `CheckTablesColumnHook` creates the missing `AD_COLUMN`, but **not** the `AD_ELEMENT`. Without it, `RegisterFields` fails with NPE. See the element sync SQL in the `alter-db` skill.

If the `com.etendoerp.copilot.devassistant` module is not installed, these webhooks won't be available. In that case, ask the user to perform these steps manually from the Etendo UI (Application Dictionary → Synchronize Terminology, etc.).

---

## 13. Webhooks vs headless endpoints

Both webhooks and headless endpoints use **Bearer token** authentication (same token from `/sws/login`). The difference is the URL path and the concept:

### Headless endpoints — automatic CRUD

Headless endpoints are **automatically generated** from the EtendoRX configuration (flows, flowpoints, tabs, fields). There is no custom Java code behind them — they simply perform CRUD operations on the tab they're mapped to.

```
{ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/{EndpointName}
```

Use them to: query data, check if records exist, create/update individual records.

### Webhooks — custom Java processes

Webhooks are **custom Java classes** written by a developer. They can do simple or complex things in a single call (e.g., `CreateAndRegisterTable` creates the physical table + registers in AD_TABLE + adds base columns, all at once).

```
{ETENDO_URL}/webhooks/{WebhookName}
```

Use them for: complex operations that involve multiple steps, validations, or side effects.

### Authentication — always Bearer token

**All calls** (both webhooks and headless) use the same Bearer token:

```bash
ETENDO_TOKEN=$(curl -s -X POST "${ETENDO_URL}/sws/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"0"}' \
  | python3 -c "import sys,json; data=json.loads(sys.stdin.buffer.read().decode('utf-8','replace')); print(data.get('token',''))")
```

Use `Authorization: Bearer ${ETENDO_TOKEN}` for every call. Do NOT use `?apikey=...`.

> For business data that requires a specific org/role context, use a non-system role. Query available roles:
> ```sql
> SELECT ad_role_id, name FROM ad_role WHERE isactive = 'Y' ORDER BY name;
> ```

### Headless CRUD operations

```bash
# GET list (with optional q filter)
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/{Endpoint}"

# GET by ID
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/{Endpoint}/{id}"

# POST (create)
curl -s -X POST -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/{Endpoint}" \
  -d '{"field1":"value1"}'

# PUT (update)
curl -s -X PUT -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  -H "Content-Type: application/json" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/{Endpoint}/{id}" \
  -d '{"field1":"newValue"}'
```

### Query filter syntax (`q` parameter)

| Operator | Meaning | Example |
|---|---|---|
| `==` | Equals | `q=name==MyWebhook` |
| `=ic=` | Case-insensitive contains | `q=name=ic=webhook` |
| `=sw=` | Starts with | `q=name=sw=Sales` |
| `=ge=` / `=le=` | Greater/less than or equal | `q=created=ge=2024-01-01` |

### Useful headless endpoints

- `moduleHeader` — list installed modules
- `moduleDBPrefix` — list module DB prefixes
- `Webhook` / `WebhookParam` — manage webhooks via CRUD
- `Table` / `Column` — inspect AD metadata

---

## 14. Fallback strategy

Skills must be resilient. The `com.etendoerp.copilot.devassistant` module may not be installed, or Tomcat may be down. Follow this priority order:

| Priority | Method | When to use |
|---|---|---|
| **1. Webhooks** | `POST /webhooks/{Name}` | Preferred — handles validations, triggers, and multi-step logic in one call |
| **2. Headless CRUD** | `GET/POST/PUT /sws/com.etendoerp.etendorx.datasource/...` | When no webhook exists for the operation, or for queries/checks |
| **3. SQL manual** | Direct `INSERT/UPDATE` in PostgreSQL | When devassistant module is not installed or Tomcat is down |
| **4. Ask the user** | Request manual action in the Etendo UI | For operations that can't be replicated via SQL (e.g., Synchronize Terminology, run triggers) |
| **5. Edit XML directly** | Modify `src-db/database/sourcedata/*.xml` | **Last resort, only with explicit user authorization** |

### Detecting availability

```bash
# Check if devassistant module is installed
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c \
  "SELECT javapackage FROM ad_module WHERE javapackage = 'com.etendoerp.copilot.devassistant' AND isactive = 'Y';"

# Check if Tomcat is responding
curl -s -o /dev/null -w "%{http_code}" "${ETENDO_URL}/sws/login" 2>/dev/null
```

If webhooks/headless are not available, inform the user and proceed with SQL. After SQL inserts, remind the user to perform any manual steps that the webhook would have handled automatically (e.g., Synchronize Terminology, Create Columns from DB).

---

## 15. XML editing — last resort

Editing XML files in `src-db/database/sourcedata/` directly is **dangerous** and should only be done with explicit user authorization. The risk:

- If there are **unexported changes in the DB** → `export.database` will overwrite your XML edits
- If there are **XML edits not yet applied** → `update.database` will overwrite DB changes that weren't exported

XML editing requires `update.database` afterwards (XML → DB direction), which is the reverse of the normal workflow (DB → XML via `export.database`).

**Before editing XML:** Always ask the user: "The webhooks and DB are not available. I can edit the XML files directly, but this is risky if there are unexported DB changes. Should I proceed?"

---

## 16. Reading sourcedata XML files

Etendo stores Application Dictionary data as XML in `src-db/database/sourcedata/`. These files are verbose and hard to read raw. Use the bundled `scripts/xml2json.py` to inspect them quickly:

```bash
# List all records (compact table, audit columns hidden)
python3 scripts/xml2json.py SMFWHE_DEFINEDWEBHOOK.xml

# Show specific columns only
python3 scripts/xml2json.py SMFWHE_DEFINEDWEBHOOK.xml --cols NAME,JAVA_CLASS

# Filter by field value (partial, case-insensitive)
python3 scripts/xml2json.py AD_TABLE.xml --filter TABLENAME=smft

# Filter by record ID prefix
python3 scripts/xml2json.py AD_COLUMN.xml --id 0D9B036E

# Find records in file A missing from file B (by shared key)
python3 scripts/xml2json.py SMFWHE_DEFINEDWEBHOOK.xml \
  --diff SMFWHE_DEFINEDWEBHOOK_ROLE.xml --key SMFWHE_DEFINEDWEBHOOK_ID

# Output raw JSON (for piping to other tools)
python3 scripts/xml2json.py AD_TABLE.xml --json

# Just count records
python3 scripts/xml2json.py AD_COLUMN.xml --count
```

The script auto-resolves filenames — pass just the filename and it searches `src-db/database/sourcedata/` directories. Use this instead of grepping raw XML.

---

## 17. Feedback collection (MANDATORY)

**ALWAYS** document issues encountered during a session in `.etendo/skill-feedback.md` in the user's project directory. This applies to **any problem** — not just webhooks. The file serves as a report the user can submit as an issue to improve the plugin skills.

**When to write — after ANY of these events:**
- A skill instruction was wrong or incomplete (e.g., wrong table name, missing parameter, incorrect URL)
- A webhook, headless endpoint, or Gradle task failed unexpectedly
- A workaround was needed (e.g., SQL instead of webhook, manual fix after a skill step)
- A compilation or runtime error was caused by code generated from a skill template
- A trigger, constraint, or validation blocked an operation that the skill didn't anticipate
- An operation succeeded but required extra steps not documented in the skill
- Time was lost due to rollbacks, retries, or trial-and-error caused by missing documentation

**Write the entry as soon as the workaround is confirmed working** — do not wait until the end of the session.

**Format:**

```markdown
# Etendo Dev Assistant — Skill Feedback

## Issues

### F1: [{skill name}] — {short description}
- **What happened:** {describe the failure or unexpected behavior}
- **What was expected:** {what should have happened according to the skill}
- **How it was resolved:** {exact workaround — SQL, command, code change, etc.}
- **Affected skill:** {e.g., etendo-module, etendo-alter-db, _guidelines}
- **Suggestion:** {how the skill should be improved to prevent this}
- **Date:** {YYYY-MM-DD}
```

**Rules:**
- Use sequential numbering (F1, F2, F3...)
- Check if the issue is already documented before adding a duplicate
- Create the file on first occurrence — don't create it empty
- Be specific: include the exact error message, the exact SQL/curl that failed, and the exact fix
- Inform the user when you add an entry: "I documented a skill issue in `.etendo/skill-feedback.md`"
