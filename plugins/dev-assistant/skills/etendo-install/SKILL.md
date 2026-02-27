---
description: "/etendo:install — Install Etendo on an existing project"
argument-hint: "[fresh]"
---

# /etendo:install — Install Etendo on an existing project

**Arguments:** `$ARGUMENTS` (optional: `fresh` to force reinstall)

---

First, read `skills/etendo-_context/SKILL.md`.

This command installs Etendo on an already-cloned project (runs `setup.web` or `install`). Use it when:
- `gradle.properties` is already configured
- You want to reinstall after a failed setup
- You're setting up a project someone else cloned

## Step 1: Detect state

Read `gradle.properties` and `build.gradle` to determine:
- Core mode (Source vs JAR)
- Infrastructure mode (Docker flags)
- Whether `config/Openbravo.properties` already exists (indicates previous setup ran)

If `config/Openbravo.properties` exists and `$ARGUMENTS` is not `fresh`:
Ask: "Etendo appears to already be set up (config/ exists). Do you want to: (1) Run `update.database` + `smartbuild` to sync, or (2) Force a full reinstall?"

## Step 2: Validate prerequisites

Check:
1. `gradle.properties` has `githubUser` and `githubToken` set -- required to download artifacts
2. `bbdd.*` properties are set
3. If Docker mode: verify containers exist and are running
   ```bash
   docker ps --filter name=etendo --format "{{.Names}} {{.Status}}"
   ```
4. If local DB: test connection
   ```bash
   psql -U {bbdd.user} -d postgres -h localhost -p {bbdd.port} -c "SELECT 1;" 2>&1
   ```

If Docker containers are not running:
```bash
./gradlew resources.up
```
Wait 10 seconds and re-check.

## Step 3: Run install sequence

> **Convention:** All `./gradlew` calls redirect output to `/tmp/etendo-{task}.log`. Read only on error.

```bash
# Always first -- initializes config/Openbravo.properties from gradle.properties
./gradlew setup > /tmp/etendo-setup.log 2>&1

# Source mode only: expand core source
./gradlew expandCore > /tmp/etendo-expandcore.log 2>&1

# Docker mode: start containers (setup must have run first to generate correct .env)
./gradlew resources.up > /tmp/etendo-resources-up.log 2>&1

# Install DB schema and deploy WAR
./gradlew install > /tmp/etendo-install.log 2>&1

# Compile and deploy
./gradlew smartbuild > /tmp/etendo-smartbuild.log 2>&1
```

On failure:
```bash
grep -E "ERROR|Exception|FAILED" /tmp/etendo-{task}.log | tail -30
```

Common errors:
- `Connection refused` -> DB not running -> start containers or local PostgreSQL
- `Authentication failed` -> wrong `bbdd.*` -> check `gradle.properties`
- `Could not resolve` -> check `githubToken`
- `invalid mount path` -> `setup` not run before `resources.up`
- Tomcat errors -> `docker exec etendo-tomcat-1 sh -c 'tail -n 100 /usr/local/tomcat/logs/openbravo.log'`

## Step 4: Verify

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:{tomcat.port}/{context.name}/security/Login
```

Show result:
```
+ Etendo is running at http://localhost:8080/etendo
  Login with your configured user credentials

Next: /etendo:context to set your active module
      /etendo:smartbuild after making changes
```
