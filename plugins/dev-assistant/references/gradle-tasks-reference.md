# Etendo Gradle Tasks Reference

**Source:** Official docs (docs.etendo.software) + etendo_core source analysis
**Date:** 2026-02-25

---

## Core Development Tasks

| Task | Description | When to use |
|---|---|---|
| `setup` | Reads `gradle.properties`, creates `config/` from templates | First time setup, after changing gradle.properties |
| `setup.web` | Full initial install: setup + DB creation + WAR deploy | Initial project bootstrap |
| `install` | Creates/initializes DB schema and compiles | After `setup`, before first run |
| `smartbuild` | Main dev loop: update.database + compile + deploy to Tomcat | After any code/XML change |
| `update.database` | Applies model changes to DB (new tables, columns, etc.) | After adding modules, changing XML model |
| `export.database` | Exports DB Application Dictionary to XML in `src-db/` | After creating/modifying AD objects (windows, tabs, columns) |
| `compile.complete` | Full recompilation of all Java sources | When incremental compile is broken |
| `generate.entities` | Regenerates Java entity classes from DB model | After adding/modifying DB columns |
| `expandCore` | Downloads and expands Etendo Core source files | Source mode only, or forced JAR expansion |
| `expandModules` | Downloads and expands module sources | When needing module source for debugging |

---

## Docker / Infrastructure Tasks

| Task | Description |
|---|---|
| `resources.up` | Runs `docker compose up -d --build` for all enabled Docker services |
| `resources.down` | Runs `docker compose down` |
| `resources.stop` | Runs `docker compose stop` |
| `resources.build` | Builds Docker images (finalizes with resources.up) |
| `generateEnvFile` | Generates `build/compose/.env` from `gradle.properties` |
| `copyComposeFiles` | Collects all `compose/*.yml` files into `build/compose/` |

**Notes:**
- `smartbuild` and `compile.complete` automatically call `copyComposeFiles` when Docker services are enabled
- `resources.build` automatically calls `resources.up` when complete

---

## Task Flags and Parameters

### `smartbuild`
```bash
./gradlew smartbuild                    # local changes (default: -Plocal=yes)
./gradlew smartbuild -Plocal=no         # pulled changes from VCS
```

### `update.database` and `export.database`
```bash
./gradlew update.database
./gradlew update.database -Dmax.threads=4

./gradlew export.database
./gradlew export.database -Dmodule=com.mycompany.mymodule   # export only one module
./gradlew export.database -Dmax.threads=4
```

### `expandCore`
```bash
./gradlew expandCore                    # source mode standard
./gradlew expandCore -PforceExpand=true # force expansion from JAR mode
./gradlew cleanExpandCore               # remove expanded files
```

### `expandModules`
```bash
./gradlew expandModules -PsupportJars=false   # force all modules to source format
```

---

## Task Dependency Chains

```
setup.web
  └─ setup
       └─ expandCore (source mode only)
  └─ install
       └─ update.database
            └─ [DB must be UP]
  └─ deploy WAR to Tomcat

smartbuild
  ├─ copyComposeFiles (when docker services enabled)
  ├─ update.database
  │    └─ [DB must be UP]
  ├─ compile
  └─ deploy WAR
       └─ [Tomcat must be UP]

export.database
  └─ [DB must be UP]
  └─ Writes XML to src-db/database/sourcedata/{MODULE}
```

---

## Typical Developer Workflow

```bash
# Day 1: Bootstrap
./gradlew setup.web

# Daily: After changing Java/XML
./gradlew smartbuild

# After: Adding a new module dependency
./gradlew update.database
./gradlew smartbuild

# After: Creating DB objects (tables, windows) via SQL
./gradlew export.database -Dmodule=com.mycompany.mymodule

# After: Adding columns to a table
./gradlew generate.entities
./gradlew smartbuild
# Docker Tomcat: auto-reloads after ~30-60s, no action needed
# Local Tomcat: must restart Tomcat manually for changes to take effect
```

---

## Infrastructure-Aware Task Execution

When `docker_com.etendoerp.docker_db=true`, the Gradle plugin manages DB container lifecycle automatically for DB-dependent tasks.

When `docker_com.etendoerp.tomcat=true`, the WAR is deployed to the Docker volume. Docker Tomcat detects the updated WAR and **auto-reloads** after ~30-60s — no manual restart needed.

If Tomcat is NOT dockerized (flag absent or false), the WAR is deployed locally but Tomcat does **NOT auto-reload** — the user **must restart Tomcat manually** for changes to take effect.
