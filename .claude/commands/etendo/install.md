# /etendo:install — Install Etendo on an existing project

**Arguments:** `$ARGUMENTS` (optional: `fresh` to force reinstall)

---

First, read `.claude/commands/etendo/_context.md`.

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
1. `gradle.properties` has `githubUser` and `githubToken` set — required to download artifacts
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

## Step 3: Run install

For Source mode, expand core first if not already done:
```bash
# Check if etendo_core/src exists
ls etendo_core/src 2>/dev/null || ./gradlew expandCore
```

Run setup:
```bash
./gradlew setup.web
```

Stream output. On error:
- Parse Gradle output for common failures:
  - `Connection refused` → DB not running → suggest `./gradlew resources.up`
  - `Authentication failed` → wrong DB credentials → show current bbdd.* values
  - `Could not resolve` → GitHub credentials issue → check githubToken
  - Tomcat errors → read `docker exec etendo-tomcat-1 sh -c 'tail -n 100 /usr/local/tomcat/logs/openbravo.log'`
- Show specific diagnostic and suggested fix

## Step 4: Verify

After successful completion:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:{tomcat.port}/{context.name}/
```

Show result:
```
✓ Etendo is running at http://localhost:8080/etendo
  Login with your configured user credentials

Next: /etendo:context to set your active module
      /etendo:smartbuild after making changes
```
