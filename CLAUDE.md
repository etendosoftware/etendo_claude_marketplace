# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is the **Etendo Dev Assistant** — a set of Claude Code slash commands that help developers work with Etendo ERP projects. The commands live in `.claude/commands/etendo/` and are used from inside an `etendo_base` project directory.

The `poc/` directory contains a proof-of-concept validating EtendoRX headless API (not the main focus).

## Slash Commands (the main product)

| Command | Purpose |
|---|---|
| `/etendo:context` | Detect and set active module, show infrastructure mode |
| `/etendo:init` | Full bootstrap: clone etendo_base + configure + setup |
| `/etendo:install` | Install Etendo on an already-cloned project |
| `/etendo:smartbuild` | Compile and deploy |
| `/etendo:update` | Synchronize DB with the model (update.database) |
| `/etendo:alter-db` | Create/modify tables and columns |
| `/etendo:window` | Create/modify Application Dictionary windows and tabs |
| `/etendo:module` | Create or configure an Etendo module |
| `/etendo:headless` | Configure EtendoRX REST endpoints |

Commands are defined as `.md` files in `.claude/commands/etendo/`. `_context.md` is the shared knowledge base (not user-facing).

## Research docs

All research that informs the commands is in `docs/`:

| File | Content |
|---|---|
| `docs/gradle-tasks-reference.md` | All Gradle tasks, flags, dependency chains |
| `docs/infrastructure-modes.md` | Source vs JAR mode, Docker flags, DB connection patterns |
| `docs/application-dictionary.md` | AD XML structure, UUID format, window/tab/field SQL patterns |
| `docs/advanced-ad.md` | Field logic, references, sequences, stored procedures, data access levels |
| `docs/java-development.md` | DAL, Action Buttons, Event Handlers, Background Processes, Callouts |
| `docs/jobs-and-actions.md` | Jobs/Actions abstraction, CloneRecordHook API |
| `docs/module-publishing.md` | Publishing modules to Nexus as JAR, registerModule, publishVersion |
| `docs/etendo-headless.md` | EtendoRX headless API reference |
| `docs/etendo-api-guide.md` | Classic DataSource API and FormInit reference |

## Commands

**Run both server and UI concurrently:**
```bash
npm run dev
```

**Run server only (with file watching):**
```bash
npm run dev --prefix poc/server
# or
cd poc/server && node --watch src/index.js
```

**Run UI only:**
```bash
npm run dev --prefix poc/ui
```

**Install dependencies:**
```bash
npm run install:all
```

**Generate Swagger docs:**
```bash
npm run docs --prefix poc/server
```

**Build UI for production:**
```bash
npm run build --prefix poc/ui
```

**Run test scripts:**
```bash
node scripts/test-masters.js
node scripts/test-sales-invoice.js
node scripts/full-cycle.js
```

## Architecture

This is a simplified UI + orchestration layer on top of the Etendo ERP. There are three layers:

```
Browser (React UI — poc/ui/)
  │  REST via Vite proxy /lite → localhost:3001
  ▼
Orchestration Layer (Node.js/Express — poc/server/)
  │  DataSource API + FormInit + EtendoRX Headless
  ▼
Etendo Core (Tomcat/PostgreSQL — etendo_core/)
```

> `poc/` is a proof-of-concept validating that EtendoRX headless works end-to-end. It is not the main focus of this repo.

### poc/server/ — Orchestration Layer

- **`src/index.js`** — Express app. Attaches `req.tenantId` (from `X-Tenant-ID` header, defaults to `'demo'`) and `req.etendoAuth` (from `Authorization` header) to every request.
- **`src/etendo.js`** — Two HTTP clients:
  - `makeHeadlessClient(url, auth)` — preferred for all CRUD. Uses EtendoRX headless endpoints at `/etendo/sws/com.etendoerp.etendorx.datasource/{endpoint}`. CSRF-free, stateless.
  - `makeClient(url, auth)` — classic client with JSESSIONID session cache. Used only for `FormInitializationComponent` (document completion). Automatically retries on `InvalidCSRFToken`.
- **`src/tenants.js`** — Loads per-tenant config from `tenants/{id}.json`. Cached in memory.
- **`src/routes/`** — Business domain routes: `auth`, `sales`, `purchases`, `masters`, `taxes`, `payables`.

### poc/ui/ — React Frontend

- React 18 + React Router v7 + TypeScript + Vite.
- **`src/App.tsx`** — App shell with sidebar nav and auth state. Auth stored in `localStorage` as `etendo_token` + `etendo_tenant`.
- **`src/styles.tsx`** — Design tokens (`C` object) and `injectGlobalCSS()`. All styling is inline CSS — no CSS files.
- **`src/pages/`** — Pages organized by domain: `masters/`, `sales/`, `purchases/`.
- Vite proxies `/lite/*` → `http://localhost:3001` in development.

### Tenant Configuration

Each tenant is a JSON file at `server/tenants/{id}.json`. The `demo.json` contains Etendo UUIDs for organization, client, warehouse, doc types, etc. Routes call `getTenant(req.tenantId)` to access these.

### Sales Order Flow

The most complex orchestration (documented in `docs/architecture.md`):
1. GET Customer + CustomerLocation (headless, parallel)
2. GET product prices via classic DataSource `ProductByPriceAndWarehouse` (requires `productSelectorId` from tenant config)
3. POST SalesOrder header (headless)
4. POST SalesOrderLine × N (headless, sequential to avoid transaction conflicts)
5. POST `FormInitializationComponent` with `inpdocaction=CO` to complete the order — only step requiring JSESSIONID

### Known Gotchas

- **"200 OK lies"**: EtendoRX sends HTTP response before the transaction commits. A 200 with an ID does not guarantee persistence. Always verify after creation if correctness matters.
- **Silent rollbacks**: Happen when a callout or selector fails after HTTP flush. The record ID in the response is real but a ghost.
- **Hibernate session poisoning**: If any HQL query throws `QuerySyntaxException`, the session is permanently marked rollback-only.
- **Only configured fields in POST**: Sending extra fields to a headless endpoint causes silent rollbacks. `ORDERTYPE`, `DOCBASETYPE`, and boolean strings are the most dangerous.
- **SalesOrderLines are created sequentially** (not parallel) to avoid transaction conflicts.
- **Product tax resolution**: Uses `resolveProductMeta()` which looks up `TaxRate` filtered by `taxCategory` and `salesPurchaseType=="S"`.

### Etendo Headless Endpoint → Tab Mapping

Configured via `docs/headless-setup.sql`:
- `Customer` / `BPCustomer` / `BPAddress` → C_BPartner tabs
- `SalesOrder` / `SalesOrderLines` → C_Order tabs (186/187)
- `SalesInvoice` / `SalesInvoiceLine` → C_Invoice tabs
- `Product`, `TaxRate`, `PriceListVersion` → catalog tabs
