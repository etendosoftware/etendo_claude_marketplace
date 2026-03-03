---
description: "/etendo:smartbuild — Compile and deploy"
argument-hint: "[remote | full]"
---

# /etendo:smartbuild — Compile and deploy

**Arguments:** `$ARGUMENTS` (optional: `remote` for VCS-pulled changes, `full` for compile.complete)

---

First, read `skills/etendo-_guidelines/SKILL.md` and `skills/etendo-_context/SKILL.md`.

For Gradle task details, flags, and dependency chains, read `references/gradle-tasks-reference.md`.

## Step 1: Verify resources are up

Check that required services are running before compiling:

```bash
# Docker DB
if docker_com.etendoerp.docker_db=true:
  docker ps --filter name=etendo-db-1 --format "{{.Status}}"
  # If not running: ./gradlew resources.up

# Docker Tomcat
if docker_com.etendoerp.tomcat=true:
  docker ps --filter name=etendo-tomcat-1 --format "{{.Status}}"
  # If not running: ./gradlew resources.up
```

If any required container is not running:
```bash
./gradlew resources.up
```
Wait for containers to be healthy before proceeding.

## Step 2: Run the build

> Redirect all gradle output to `/tmp`. Read only on failure.

Detect JAVA_HOME first (see `_context` skill section 6):
```bash
JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "$JAVA_HOME")

# Standard (local changes):
JAVA_HOME=${JAVA_HOME} ./gradlew smartbuild > /tmp/etendo-smartbuild.log 2>&1

# Remote/VCS-pulled changes ($ARGUMENTS contains 'remote'):
JAVA_HOME=${JAVA_HOME} ./gradlew smartbuild -Plocal=no > /tmp/etendo-smartbuild.log 2>&1

# Full recompile ($ARGUMENTS contains 'full'):
JAVA_HOME=${JAVA_HOME} ./gradlew compile.complete > /tmp/etendo-smartbuild.log 2>&1
```

Check result:
```bash
tail -5 /tmp/etendo-smartbuild.log
```

## Step 3: Handle errors

**Compilation error** -- show the Java compiler error with file and line number. Check if it's in a module file the dev recently edited.

**update.database error:**
```bash
# Read DB logs
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "SELECT message, updated FROM ad_errorlog ORDER BY updated DESC LIMIT 20;"
```

**Tomcat deploy error:**
```bash
docker exec etendo-tomcat-1 sh -c 'tail -n 100 /usr/local/tomcat/logs/openbravo.log'
# or local:
tail -n 100 $CATALINA_HOME/logs/openbravo.log
```

Parse the log for:
- `ERROR` lines -> show them highlighted
- `Exception` stack traces -> show first 5 lines
- `BUILD SUCCESSFUL` -> confirm success

**Common fixes:**
- `OutOfMemoryError` -> suggest increasing `org.gradle.jvmargs=-Xmx4g` in `gradle.properties`
- `Could not resolve` -> check GitHub token is valid, run `./gradlew dependencies`
- XML parse error in sourcedata -> show which XML file is malformed

## Step 4: Post-deploy — Tomcat behavior

After `smartbuild` (or `compile.complete`) finishes and deploys the WAR, the behavior depends on the Tomcat mode:

| Tomcat mode | What happens after deploy | Action required |
|---|---|---|
| **Docker** (`docker_com.etendoerp.tomcat=true`) | Tomcat detects the new WAR and **auto-reloads** after a short delay (~30-60s). | Wait for reload to complete. Optionally check logs: `docker exec etendo-tomcat-1 sh -c 'tail -n 50 /usr/local/tomcat/logs/openbravo.log'` |
| **Local** (no docker tomcat flag) | The WAR is deployed but Tomcat does **NOT auto-reload**. | The user **must restart Tomcat manually** for changes to take effect. |

Inform the user accordingly:

```bash
# Check Tomcat mode
DOCKER_TOMCAT=$(grep -c 'docker_com.etendoerp.tomcat=true' gradle.properties 2>/dev/null || echo "0")
```

If Docker Tomcat → tell the user: "Tomcat will auto-reload in a moment. Check the UI after ~30-60 seconds."

If local Tomcat → tell the user: "You need to restart Tomcat manually for the changes to take effect."

## Step 5: Confirm success

```
+ smartbuild completed in {duration}
  Etendo is running at {etendoUrl from context.json, default: http://localhost:8080/etendo}
```

If Docker Tomcat:
```
  Tomcat (Docker) will auto-reload shortly. Wait ~30-60s before testing.
```

If local Tomcat:
```
  Tomcat (local) requires a manual restart to pick up changes.
```

If the active module is set (from context), also remind:
```
  Active module: {module}
  After AD changes, export with: ./gradlew export.database -Dmodule={javapackage}
  (Requires Tomcat DOWN — run ./gradlew resources.down first)
```
