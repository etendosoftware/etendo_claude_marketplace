# Etendo Infrastructure Modes

**Source:** Official docs + etendo_core/modules/com.etendoerp.docker/tasks.gradle analysis
**Date:** 2026-02-25

---

## Overview

An Etendo project can run each component (DB, Tomcat, RX, Copilot) either locally (native process) or in Docker. This is controlled entirely by `gradle.properties` flags. The Gradle plugin reads these flags and orchestrates Docker Compose accordingly.

---

## Core vs JAR Mode

### Source Mode

`build.gradle` contains:
```groovy
etendo {
    coreVersion = "[25.1.0,26.1.0)"
}
```

- `etendo_core/` exists locally with full Java source
- First-time setup requires `./gradlew expandCore` before `./gradlew setup`
- Full compilation on every `smartbuild` → slower builds
- **Allows modifying core files** (callout fixes, servlet patches)
- Used when contributing to Etendo Core or needing deep customization

### JAR Mode

`build.gradle` contains:
```groovy
dependencies {
    implementation('com.etendoerp.platform:etendo-core:[25.1.0,26.1.0)')
    // ... other deps
}
```
(The `etendo {}` block is commented out or absent)

- No `etendo_core/` source — core comes as pre-compiled JAR
- Faster builds, smaller workspace
- Cannot modify core files directly (use `expandCore -PforceExpand=true` to inspect)
- **Recommended for module development** (the typical use case)
- Dynamic dependency resolution — updates automatically on version change

### Detecting the mode
```bash
grep -c "etendo {" build.gradle          # > 0 → source mode
grep -c "etendo-core" build.gradle       # > 0 → JAR mode
ls etendo_core/ 2>/dev/null && echo "source" || echo "jar"
```

---

## Docker Flags in `gradle.properties`

| Property | Effect | Container name |
|---|---|---|
| `docker_com.etendoerp.docker_db=true` | DB runs in Docker | `etendo-db-1` |
| `docker_com.etendoerp.tomcat=true` | Tomcat runs in Docker | `etendo-tomcat-1` |
| `docker_com.etendoerp.etendorx=true` | EtendoRX services in Docker | `etendo-etendorx-1` |
| `docker_com.etendoerp.etendorx_async=true` | Async RX + Kafka in Docker | — |
| `docker_com.etendoerp.copilot=true` | Copilot AI service in Docker | `etendo-copilot-1` |

**Rule:** If a flag is absent or `false`, that service is expected to be running locally (native install or managed separately).

---

## Common Deployment Configurations

### All-in-Docker (recommended for new devs)
```properties
docker_com.etendoerp.docker_db=true
docker_com.etendoerp.tomcat=true
```
```bash
./gradlew resources.up     # starts DB + Tomcat containers
./gradlew setup.web        # initializes Etendo
./gradlew smartbuild       # compile and deploy
```

### Local DB + Docker Tomcat
```properties
# docker_com.etendoerp.docker_db not set (or false)
docker_com.etendoerp.tomcat=true
```
```properties
bbdd.sid=etendo
bbdd.port=5432
bbdd.user=tad
bbdd.password=tad
```
- DB connection points to local PostgreSQL
- Tomcat is containerized
- `resources.up` starts only Tomcat container

### All-Local (advanced, no Docker)
```properties
# No docker_* flags set
```
- Dev manages PostgreSQL and Tomcat installations manually
- `resources.up` / `resources.down` do nothing meaningful
- Direct `psql` or connection string for DB access

### Full Stack + RX (microservices)
```properties
docker_com.etendoerp.docker_db=true
docker_com.etendoerp.tomcat=true
docker_com.etendoerp.etendorx=true
```

---

## Resource Dependencies

```
To run DB tasks (update.database, export.database, install):
  └─ DB must be UP

To run Tomcat tasks (smartbuild deploy, test UI):
  └─ Tomcat must be UP
  └─ DB must be UP

To run RX endpoints (/etendo/sws/...):
  └─ RX services must be UP
  └─ DB must be UP
  └─ Tomcat must be UP
```

### Starting resources
```bash
# Docker services
./gradlew resources.up

# Specific Docker container
docker start etendo-db-1
docker start etendo-tomcat-1

# Check status
docker ps --filter name=etendo
```

---

## Executing SQL Against the DB

### Docker DB
```bash
docker exec -i etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} < script.sql
docker exec etendo-db-1 psql -U tad -d etendo -c "SELECT 1;"
```

### Local DB
```bash
psql -U {bbdd.user} -d {bbdd.sid} -h localhost -p {bbdd.port} < script.sql
psql -U tad -d etendo -c "SELECT 1;"
```

### Detecting connection from `gradle.properties`
```
bbdd.user     → DB username
bbdd.password → DB password
bbdd.sid      → DB name (database)
bbdd.port     → DB port (default: 5432)
bbdd.systemUser / bbdd.systemPassword → superuser (for initial setup)
```

---

## Post-Deploy Tomcat Behavior

After `smartbuild` or `compile.complete` deploys the WAR:

| Tomcat mode | Behavior | Action required |
|---|---|---|
| **Docker** (`docker_com.etendoerp.tomcat=true`) | Tomcat detects the updated WAR and **auto-reloads** after ~30-60s | Wait for reload to complete |
| **Local** (flag absent or `false`) | WAR is deployed but Tomcat does **NOT auto-reload** | User **must restart Tomcat manually** |

---

## Reading Tomcat Logs

### Docker Tomcat
```bash
docker exec etendo-tomcat-1 sh -c 'tail -n 200 /usr/local/tomcat/logs/openbravo.log'
docker logs etendo-tomcat-1 --tail 100
```

### Local Tomcat
```bash
tail -n 200 $CATALINA_HOME/logs/openbravo.log
```

---

## Kafka / Async (when enabled)
```properties
kafka.enable=true
kafka.connect.bbdd.host=host.docker.internal
kafka.connect.host=kafka
```
Used with `docker_com.etendoerp.etendorx_async=true`. Enables event-driven processing for EtendoRX.
