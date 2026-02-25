# /etendo:context — Detect and manage development context

**Arguments:** `$ARGUMENTS` (optional: `set module=com.x.y`, `reset`, blank = show)

---

First, read `.claude/commands/etendo/_context.md` to understand how context resolution works.

Then perform the following steps:

## Step 1: Read all context sources

1. Check for `.etendo/context.json` and load it if it exists
2. Read `gradle.properties` — extract: `bbdd.user`, `bbdd.password`, `bbdd.sid`, `bbdd.port`, `context.name`, and all `docker_*` properties
3. Read `build.gradle` — determine **Source mode** vs **JAR mode**
4. Check if CWD is inside a `modules/com.x.y.z/` path — if so, extract the module package

## Step 2: Handle arguments

- **No arguments** → proceed to display (Step 3)
- **`set module=com.x.y.z`** → resolve the module's dbPrefix from DB (see below), update `.etendo/context.json`, display confirmation
- **`reset`** → delete `.etendo/context.json`, display "Context cleared"
- **Any other text** → treat as module java package to set (shortcut for `set module=...`)

To resolve dbPrefix when setting a module:
```bash
docker exec -i etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -t -c \
  "SELECT p.name FROM ad_module_dbprefix p JOIN ad_module m ON m.ad_module_id = p.ad_module_id WHERE m.javapackage = '{module}';"
```
(Adjust for local DB if `docker_com.etendoerp.docker_db` is not true)

## Step 3: Display context summary

Present a clear, structured summary:

```
═══════════════════════════════════════════
 Etendo Dev Context
═══════════════════════════════════════════

 Core mode:       [Source | JAR]
 Core version:    [from build.gradle]

 Infrastructure:
   Database:      [Docker (etendo-db-1) | Local]
   Tomcat:        [Docker (etendo-tomcat-1) | Local]
   EtendoRX:      [Docker | Not configured]
   Copilot:       [Docker | Not configured]

 DB connection:
   User:          {bbdd.user}
   Database:      {bbdd.sid}
   Port:          {bbdd.port}
   Etendo URL:    http://localhost:{tomcat.port}/{context.name}

 Active module:   [com.x.y.z | ⚠ Not set]
 DB prefix:       [PREFIX | —]
 Module path:     [modules/com.x.y.z | —]

 Context source:  [.etendo/context.json | CWD auto-detect | Not set]
═══════════════════════════════════════════
```

## Step 4: Suggest next action

- If no active module is set: "Run `/etendo:context set module=com.mycompany.mymodule` to set the active module"
- If context.json does not exist: "Tip: set an active module so all `/etendo:*` commands know which module to target"
- If DB is Docker but `docker ps` shows the container is not running: "⚠ DB container is not running. Run `./gradlew resources.up` or `docker start etendo-db-1`"
