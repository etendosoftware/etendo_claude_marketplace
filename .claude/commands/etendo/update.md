# /etendo:update — Synchronize database with the model

**Arguments:** `$ARGUMENTS` (optional: `full` for update + smartbuild, `threads=N` for parallel)

---

First, read `.claude/commands/etendo/_context.md`.

`update.database` applies changes from the Application Dictionary (XML sourcedata) and module definitions into the live PostgreSQL database. Run this after:
- Adding a new module dependency
- Changing column definitions in XML
- Pulling changes from VCS that include AD XML changes

## Step 1: Check DB is up

```bash
# Docker
docker ps --filter name=etendo-db-1 --format "{{.Status}}"

# Local
psql -U {bbdd.user} -d {bbdd.sid} -h localhost -p {bbdd.port} -c "SELECT 1;" 2>&1
```

If DB is not reachable:
- Docker: `./gradlew resources.up` or `docker start etendo-db-1`
- Local: guide to start PostgreSQL service

## Step 2: Run update.database

```bash
# Standard
./gradlew update.database

# With parallelism (faster for large schemas)
./gradlew update.database -Dmax.threads={N}   # N = $ARGUMENTS threads value, or auto = half cores
```

Stream output and show progress.

## Step 3: Handle errors

**Column size change rejected:**
Some column size changes require manual SQL first:
```sql
ALTER TABLE {tablename} ALTER COLUMN {columnname} TYPE VARCHAR({newsize});
```
Then re-run `update.database`.

**Function/trigger errors:**
```bash
# Check recent DB errors
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "SELECT message, updated FROM ad_errorlog ORDER BY updated DESC LIMIT 10;"
```

**"Table already exists"** — usually harmless if update.database was interrupted mid-run. Re-run to continue.

## Step 4: Follow-up actions

If `$ARGUMENTS` contains `full` or after successful update:
```
✓ update.database complete

Next steps depending on what changed:
  • New columns added     → run /etendo:smartbuild (includes generate.entities)
  • Only AD data changed  → run /etendo:smartbuild to redeploy
  • Module added          → run /etendo:smartbuild -Plocal=no
```
