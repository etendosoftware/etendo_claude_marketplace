# /etendo:init — Bootstrap a new Etendo project

**Arguments:** `$ARGUMENTS` (optional: target directory path)

---

First, read `.claude/commands/etendo/_context.md`.

This command performs a full bootstrap of a new Etendo development environment. It is designed for a developer setting up Etendo for the first time.

## Step 1: Determine target directory

- If `$ARGUMENTS` is provided, use it as the target directory
- Otherwise, ask: "Where should I clone the project? (default: ./etendo_base)"

## Step 2: Check prerequisites

Verify before proceeding:

1. **Git** — `git --version`
2. **Java 17+** — `java -version` and check `$JAVA_HOME`
   - If JAVA_HOME is not set: "Please set JAVA_HOME to a Java 17 installation: `export JAVA_HOME=/path/to/java17`"
3. **Docker** (if dev wants Docker mode) — `docker info`
4. **Gradle** is NOT required — `gradlew` is bundled in the repo

Show a checklist and stop if critical prerequisites are missing.

## Step 3: Clone etendo_base

```bash
git clone https://github.com/etendosoftware/etendo_base.git {target_dir}
cd {target_dir}
```

If the directory already exists, check if it's a valid Etendo project (has `gradle.properties`, `build.gradle` with etendo plugin). If yes, ask: "Directory already exists and looks like an Etendo project. Run `/etendo:install` instead, or use a different directory?"

## Step 4: Configure gradle.properties

Read the existing `gradle.properties` and identify what needs to be filled:

**GitHub credentials** (required for downloading Etendo artifacts):
- Check if `githubUser` and `githubToken` are set
- If not, ask: "Do you have a GitHub token with `read:packages` permission? (Y/N)"
  - If yes: ask for token
  - If no: "You can generate one at https://github.com/settings/tokens — needs `read:packages` scope. The setup.sh script can also handle authentication via GitHub Device Flow."

**Database configuration:**
Ask (with defaults shown):
- DB host: `localhost` (only relevant if DB is NOT in Docker)
- DB name (bbdd.sid): `etendo`
- DB user (bbdd.user): `tad`
- DB password: `tad`
- DB port: `5432`

**Infrastructure mode:**
Ask: "How do you want to run Etendo?"
1. All Docker (recommended for new devs) — sets `docker_com.etendoerp.docker_db=true` + `docker_com.etendoerp.tomcat=true`
2. Local DB + Docker Tomcat
3. All local (I manage DB and Tomcat myself)

Write the completed `gradle.properties`.

## Step 5: Determine Core mode

Ask: "Which Etendo Core mode?"
1. **JAR mode** (recommended) — fastest setup, downloads pre-compiled core
2. **Source mode** — full source access, needed for core development

Show current `build.gradle` and explain the difference if needed.

## Step 6: Run setup

For Docker mode, run `resources.up` first:
```bash
./gradlew resources.up
```
Wait and verify containers are running: `docker ps --filter name=etendo`

Then run setup:
```bash
# JAR mode:
./gradlew setup.web

# Source mode:
./gradlew expandCore
./gradlew setup.web
```

Stream Gradle output. If it fails:
- Read Tomcat/DB logs automatically
- Suggest specific fix based on the error
- Offer to retry

## Step 7: Confirm success

After setup completes, verify:
```bash
curl -s http://localhost:8080/{context.name}/health 2>/dev/null || echo "Tomcat not yet up"
```

Show summary:
```
✓ Etendo bootstrapped successfully
  Project:  {target_dir}
  URL:      http://localhost:8080/{context.name}
  DB:       {bbdd.sid} @ localhost:{bbdd.port}
  Mode:     [Source | JAR] / [Docker | Local]

Next steps:
  cd {target_dir}
  /etendo:context set module=com.mycompany.mymodule
  /etendo:smartbuild
```
