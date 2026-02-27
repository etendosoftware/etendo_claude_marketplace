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
API_KEY=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('apikey',''))")
DB_PREFIX=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('dbPrefix',''))")
MODULE_JP=$(cat .etendo/context.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('module',''))")
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
curl -s -X POST "${ETENDO_URL}/webhooks/?name=CheckTablesColumnHook&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"TableID\": \"${TABLE_ID}\"}"

# 2. SyncTerms — synchronize terms
curl -s -X POST "${ETENDO_URL}/webhooks/?name=SyncTerms&apikey=${API_KEY}" \
  -H "Content-Type: application/json" -d '{}'

# 3. ElementsHandler — auto-correct elements
curl -s -X POST "${ETENDO_URL}/webhooks/?name=ElementsHandler&apikey=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"TableID\": \"${TABLE_ID}\"}"
```

Never skip or reorder these steps. See `alter-db` and `window` skills for full details.

---

## 13. Headless REST endpoints & authentication

Headless (EtendoRX) endpoints use the `/sws/` path for all operations — both data entities and webhook management.

### Authentication: obtain a Bearer token

For 99% of operations (webhooks, headless CRUD, admin tasks), log in as **System Administrator** (role `"0"`):

```bash
ETENDO_TOKEN=$(curl -s -X POST "${ETENDO_URL}/sws/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"0"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
```

The token is a JWT. Use it as `Authorization: Bearer` header for all headless calls.

> For business data that requires a specific org/role context, use a non-system role. Query available roles:
> ```sql
> SELECT ad_role_id, name FROM ad_role WHERE isactive = 'Y' ORDER BY name;
> ```

### Base URL pattern

```
{ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/{EndpointName}
```

### CRUD operations

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

The `q` parameter supports RSQL-like operators:

| Operator | Meaning | Example |
|---|---|---|
| `==` | Equals | `q=name==MyWebhook` |
| `=ic=` | Case-insensitive contains | `q=name=ic=webhook` |
| `=sw=` | Starts with | `q=name=sw=Sales` |
| `=ge=` / `=le=` | Greater/less than or equal | `q=created=ge=2024-01-01` |

### Webhook management via headless API

Webhooks can also be managed (CRUD) through headless endpoints, not just via the `RegisterNewWebHook` webhook:

- `Webhook` — header entity (name, javaclass, module)
- `WebhookParam` — parameters for a webhook

```bash
# List all registered webhooks
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/Webhook"

# Get a specific webhook by name
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/Webhook?q=name==MyWebhook"

# Get params of a webhook
curl -s -H "Authorization: Bearer ${ETENDO_TOKEN}" \
  "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/WebhookParam?q=webhook==WEBHOOK_ID"
```

### Other useful headless endpoints

- `moduleHeader` — list installed modules
- `moduleDBPrefix` — list module DB prefixes

### Strategy

Use **webhooks** (via `?name=...&apikey=...`) as the primary creation method — they handle triggers, validation, and ID generation. Use **headless endpoints** (via Bearer token) for pre-creation checks, queries, CRUD on entities, and operations with no webhook equivalent.
