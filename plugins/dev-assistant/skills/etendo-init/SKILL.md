---
description: "/etendo:init — Bootstrap a new Etendo project"
argument-hint: "[target directory path]"
---

# /etendo:init — Bootstrap a new Etendo project

**Arguments:** `$ARGUMENTS` (optional: target directory path)

---

First, read `skills/etendo-_guidelines/SKILL.md` and `skills/etendo-_context/SKILL.md`.

This command performs a full bootstrap of a new Etendo development environment. It is designed for a developer setting up Etendo for the first time.

## Step 1: Determine target directory

- If `$ARGUMENTS` is provided, use it as the target directory
- Otherwise, ask: "Where should I clone the project? (default: ./etendo_base)"

## Step 2: Check prerequisites

Verify before proceeding:

1. **Git** -- `git --version`
2. **Java 17+** -- `java -version` and check `$JAVA_HOME`
   - If JAVA_HOME is not set: "Please set JAVA_HOME to a Java 17 installation: `export JAVA_HOME=/path/to/java17`"
3. **Docker** (if dev wants Docker mode) -- `docker info`
4. **Gradle** is NOT required -- `gradlew` is bundled in the repo

Show a checklist and stop if critical prerequisites are missing.

## Step 3: Clone etendo_base

```bash
git clone https://github.com/etendosoftware/etendo_base.git {target_dir}
cd {target_dir}
```

If the directory already exists, check if it's a valid Etendo project (has `gradle.properties`, `build.gradle` with etendo plugin). If yes, ask: "Directory already exists and looks like an Etendo project. Run `/etendo:install` instead, or use a different directory?"

## Step 4: Configure gradle.properties

Read the existing `gradle.properties` and identify what needs to be filled:

**GitHub credentials** (required -- Etendo artifacts are hosted in GitHub Packages):

Check `gradle.properties` for `githubUser` and `githubToken`. If either is empty:

1. Tell the developer: "You need a GitHub Personal Access Token with `read:packages` scope to download Etendo artifacts."

2. Guide them to generate one:
   - Go to: **GitHub -> Settings -> Developer Settings -> Personal access tokens -> Tokens (classic)**
   - Click **Generate new token (classic)**
   - Select scope: + `read:packages`
   - Copy the generated token (starts with `ghp_` or `gho_`)

3. Ask: "What is your GitHub username?" and "Paste your GitHub token:"

4. Write both into `gradle.properties`:
   ```properties
   githubUser=their-github-username
   githubToken=ghp_their_token_here
   ```

5. **Do NOT proceed** until these are set -- all Gradle tasks will fail without valid credentials.

**Database configuration:**
Ask (with defaults shown):
- DB host: `localhost` (only relevant if DB is NOT in Docker)
- DB name (bbdd.sid): `etendo`
- DB user (bbdd.user): `tad`
- DB password: `tad`
- DB port: `5432`

**Infrastructure mode:**
Ask: "How do you want to run Etendo?"
1. All Docker (recommended for new devs) -- sets `docker_com.etendoerp.docker_db=true` + `docker_com.etendoerp.tomcat=true`
2. Local DB + Docker Tomcat
3. All local (I manage DB and Tomcat myself)

Write the completed `gradle.properties`.

## Step 5: Determine Core mode

Ask: "Which Etendo Core mode?"
1. **JAR mode** (recommended) -- fastest setup, downloads pre-compiled core
2. **Source mode** -- full source access, needed for core development

Show current `build.gradle` and explain the difference if needed.

## Step 6: Run bootstrap sequence

> **Convention:** All `./gradlew` calls redirect output to `/tmp/etendo-{task}.log`. Read that file only if the task fails.

Detect JAVA_HOME first (see `_context` skill section 6), then execute in this exact order:

```bash
# Detect JAVA_HOME (must be Java 17):
JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "$JAVA_HOME")

# 6a. ALWAYS first -- initializes config/Openbravo.properties from gradle.properties
JAVA_HOME=${JAVA_HOME} ./gradlew setup > /tmp/etendo-setup.log 2>&1

# 6b. Source mode only: expand core source
JAVA_HOME=${JAVA_HOME} ./gradlew expandCore > /tmp/etendo-expandcore.log 2>&1

# 6c. Docker mode: start containers (setup must run first to generate correct .env with paths)
JAVA_HOME=${JAVA_HOME} ./gradlew resources.up > /tmp/etendo-resources-up.log 2>&1
docker ps --filter name=etendo --format "{{.Names}} {{.Status}}"

# 6d. Create DB schema and deploy WAR
JAVA_HOME=${JAVA_HOME} ./gradlew install > /tmp/etendo-install.log 2>&1

# 6e. Compile and deploy
JAVA_HOME=${JAVA_HOME} ./gradlew smartbuild > /tmp/etendo-smartbuild.log 2>&1
```

On failure, diagnose:
```bash
grep -E "ERROR|Exception|FAILED" /tmp/etendo-{task}.log | tail -30
```

Common errors:
- `invalid mount path` -> `setup` not run before `resources.up`
- `Connection refused` -> DB container not yet up -> wait and retry
- `Authentication failed` -> wrong `bbdd.*` credentials
- `Could not resolve` -> invalid `githubToken`

## Step 7: Confirm success

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/{context.name}/security/Login
```

Show summary:
```
+ Etendo bootstrapped successfully
  Project:  {target_dir}
  URL:      http://localhost:8080/{context.name}
  DB:       {bbdd.sid} @ localhost:{bbdd.port}
  Mode:     [Source | JAR] / [Docker | Local]

Next steps:
  /etendo:context set module=com.mycompany.mymodule
  /etendo:smartbuild
```
