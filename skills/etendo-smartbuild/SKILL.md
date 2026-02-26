---
name: "etendo:smartbuild"
description: "/etendo:smartbuild — Compile and deploy"
argument-hint: "[remote | full]"
---

# /etendo:smartbuild — Compile and deploy

**Arguments:** `$ARGUMENTS` (optional: `remote` for VCS-pulled changes, `full` for compile.complete)

---

First, read `~/.claude/skills/etendo-_context/SKILL.md`.

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

```bash
# Standard (local changes):
./gradlew smartbuild > /tmp/etendo-smartbuild.log 2>&1

# Remote/VCS-pulled changes ($ARGUMENTS contains 'remote'):
./gradlew smartbuild -Plocal=no > /tmp/etendo-smartbuild.log 2>&1

# Full recompile ($ARGUMENTS contains 'full'):
./gradlew compile.complete > /tmp/etendo-smartbuild.log 2>&1
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

## Step 4: Confirm success

```
+ smartbuild completed in {duration}
  Etendo is running at http://localhost:{port}/{context.name}
```

If the active module is set (from context), also remind:
```
  Active module: {module}
  Run /etendo:export after any AD changes (windows, tabs, fields)
```
