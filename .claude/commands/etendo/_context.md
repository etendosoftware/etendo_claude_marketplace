# Etendo Dev Assistant — Shared Context

This file is NOT a user-facing command. It is read by all `/etendo:*` commands as their first step to establish the operational context.

---

## 1. Detect the Project

**Verify you are inside an Etendo project** by checking:
```
gradle.properties   → contains bbdd.sid, bbdd.user, context.name
build.gradle        → contains etendo plugin or etendo-core dependency
```

If neither exists in CWD, search parent directories up to 3 levels. If not found, inform the dev: "This does not appear to be an Etendo project. Run /etendo:init to bootstrap one, or navigate to your etendo_base directory."

---

## 2. Detect Core Mode (Source vs JAR)

Read `build.gradle` and check:

**Source mode** — `build.gradle` contains an `etendo { }` block:
```groovy
etendo {
    coreVersion = "[25.1.0,26.1.0)"
}
```
- `etendo_core/` directory exists locally with full Java source
- Compilation is slower but core files can be modified
- First-time setup needs `./gradlew expandCore` before `./gradlew setup`
- Used when contributing to core or applying deep patches

**JAR mode** — `build.gradle` contains core as a dependency:
```groovy
implementation('com.etendoerp.platform:etendo-core:[25.1.0,26.1.0)')
```
- No local `etendo_core/` source — core is a pre-compiled JAR
- Recommended for module development: faster builds, cleaner workspace
- To inspect/patch core temporarily: `./gradlew expandCore -PforceExpand=true`

---

## 3. Detect Infrastructure Mode

Read `gradle.properties` and check which services are dockerized:

| Property | Value | Meaning |
|---|---|---|
| `docker_com.etendoerp.docker_db` | `true` | DB runs in Docker (`etendo-db-1`) |
| `docker_com.etendoerp.tomcat` | `true` | Tomcat runs in Docker (`etendo-tomcat-1`) |
| `docker_com.etendoerp.etendorx` | `true` | RX services in Docker |
| `docker_com.etendoerp.copilot` | `true` | Copilot in Docker |

**If a property is absent or `false` → that service runs locally** (native install).

**Resource dependencies (critical):**
- DB must be UP before: `update.database`, `export.database`, `install`, `smartbuild`
- Tomcat must be UP before: `smartbuild` deploy, UI access, RX endpoints
- Start Docker services: `./gradlew resources.up`
- Stop: `./gradlew resources.down`

---

## 4. Read DB Connection Parameters

From `gradle.properties`:
```
bbdd.user       → DB username (e.g. tad)
bbdd.password   → DB password
bbdd.sid        → DB name (e.g. etendo)
bbdd.port       → DB port (default: 5432)
context.name    → Etendo context/webapp name (e.g. etendo)
```

**Executing SQL:**
```bash
# Docker DB:
docker exec -i etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid}
docker exec -i etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} < script.sql

# Local DB:
psql -U {bbdd.user} -d {bbdd.sid} -h localhost -p {bbdd.port}
```

---

## 5. Detect or Ask for Active Module

Resolve in this order:

1. **`.etendo/context.json`** in project root — explicit override set by `/etendo:context`
2. **CWD auto-detect** — if current path contains `modules/com.x.y.z/`, extract the java package
3. **Ask the dev** — "Which module are you working on? (e.g. com.mycompany.mymodule)"

The active module determines:
- Where to write generated XML files
- The DB prefix to use for table/column names
- The `export.database -Dmodule=` filter
- The `AD_MODULE_ID` in all SQL INSERTs

### `.etendo/context.json` format
```json
{
  "module": "com.mycompany.mymodule",
  "modulePath": "modules/com.mycompany.mymodule",
  "dbPrefix": "MYMOD",
  "etendoUrl": "http://localhost:8080"
}
```

To find dbPrefix of a module, query:
```sql
SELECT name FROM ad_module_dbprefix WHERE ad_module_id = (
  SELECT ad_module_id FROM ad_module WHERE javapackage = 'com.mycompany.mymodule'
);
```

---

## 6. Key Gradle Tasks Reference

| Task | Use for |
|---|---|
| `./gradlew setup.web` | Full initial install (DB + WAR) |
| `./gradlew smartbuild` | Compile + deploy after any change |
| `./gradlew update.database` | Apply model changes to DB |
| `./gradlew export.database -Dmodule=X` | Export AD changes to XML after SQL |
| `./gradlew generate.entities` | Regenerate Java entities after column changes |
| `./gradlew resources.up` | Start Docker services |
| `./gradlew resources.down` | Stop Docker services |
| `./gradlew expandCore` | Expand core source (source mode) |

---

## 7. Always Confirm Before Running Destructive Operations

Operations that modify the database (SQL, `update.database`) or compile+deploy (`smartbuild`) should be shown to the dev first with a clear summary of what will happen. Never execute without confirmation.

Exceptions: reading files, showing status, dry-run analysis.

---

## 8. Reading Logs on Error

If a Gradle task fails, read the relevant logs:

```bash
# Docker Tomcat logs
docker exec etendo-tomcat-1 sh -c 'tail -n 200 /usr/local/tomcat/logs/openbravo.log'

# Docker DB logs
docker logs etendo-db-1 --tail 50

# Gradle output is sufficient for compile errors
```
