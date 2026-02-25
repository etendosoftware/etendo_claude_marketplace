# Etendo Lite — Global Spec

**Etendo target version:** 26Q1
**Date:** 2026-02-19

---

## Problem

Etendo is a full-featured ERP with two main friction points:

1. **Initial setup** — before operating, dozens of entities must be configured
   (organization, warehouse, price lists, taxes, document types, payment terms, etc.)
   Order matters, there are hidden dependencies, and there is no guided flow.

2. **Daily operation** — creating an invoice requires navigating nested tabs, knowing
   ERP terminology, and understanding non-obvious relationships between entities.

Etendo Lite simplifies **both**.

---

## Goal

Build a system that:
1. Guides new client onboarding (technical config + master data loading) in an assisted, ordered way
2. Allows sales and purchase flows through a simple, opinionated UX

**Does not reimplement business logic.** The Etendo backend keeps running and does all the work.

---

## What this is NOT

- Not a fork of Etendo
- Does not reimplement business logic
- Does not replace the Etendo backend (it keeps running, unmodified)
- Does not cover the full ERP feature set (intentionally scoped)
- Not multi-tenant in this phase

---

## The Two Phases of Use

### Phase A: New Client Onboarding

Everything a new client needs to start operating from day one.
Split into two sequential sub-phases:

#### A1: Technical Configuration

Etendo has hidden dependencies between entities — order matters.
In the original ERP: dozens of unguided windows. In Etendo Lite: an automatic sequential wizard.

| Step | Entity | Complexity in Etendo | In Etendo Lite |
|---|---|---|---|
| 1 | Organization | Window with 15+ fields | 3 fields: name, country, currency |
| 2 | Warehouse | Separate window, requires org | Created automatically with the org |
| 3 | Document Types | Numbering, sequences per type | Auto-defaults for sales and purchases |
| 4 | Taxes | Categories, rates, fiscal zones | Pre-defined templates per country |
| 5 | Sales Price List | Versions, currency, type | 2 fields: name and currency |
| 6 | Purchase Price List | Same | Same |
| 7 | Payment Terms | Due date configuration | Selector: immediate / 30 days / 60 days |
| 8 | Payment Methods | Bank accounts, cash, transfer | Selector with defaults |
| 9 | Business Partner Category | Required before creating a BP | Created automatically (Customers / Vendors) |

**Output:** Etendo configured and ready to receive master data.

#### A2: Master Data Loading

Once the system is configured, the client's base business data is loaded.
All from Etendo Lite — no need to touch the original ERP.

| Master | Minimum fields in Etendo | In Etendo Lite |
|---|---|---|
| Products / Items | Category, tax, UOM, price per list | Simple form + price assignment on sales and purchase lists |
| Customers | BP with location, category, price list, payment terms | 6-field form |
| Vendors | Same as customer with vendor type | 6-field form |

**Bulk import:** fixed-template CSV download for products, customers, and vendors.
**Single entry:** simple form for individual records.

**Output:** master data loaded, system ready to operate.

### Phase B: Daily Operations

Day-to-day flows. Linear, no nested tabs, no ERP jargon.

**Sales:**
- Create / search customer (if not loaded in A2)
- New sales order → product lines → complete
- New invoice from order → complete
- View invoice status

**Purchases:**
- Create / search vendor (if not loaded in A2)
- New purchase order → product lines → complete
- New purchase invoice (receipt) → complete
- View invoice status

---

## Architecture

### Deployment Model

The Orchestration Layer is a **single multi-tenant deployment** on its own server.
Each tenant maps to one Etendo instance. Multiple clients can share the same Orchestration Layer,
each pointing to their own Etendo backend.

```
                    ┌─────────────────────────────────┐
  client-a.com ───▶ │                                 │
  client-b.com ───▶ │       Etendo Lite UI            │
  client-c.com ───▶ │       (React, per-tenant)       │
                    └──────────────┬──────────────────┘
                                   │ REST + Basic Auth
                                   │ X-Tenant-ID header (or subdomain)
                    ┌──────────────▼──────────────────┐
                    │                                 │
                    │     Orchestration Layer         │  ← single deployment
                    │     (Node.js + Express)         │
                    │                                 │
                    │  Tenant registry (config file   │
                    │  or env vars per tenant)        │
                    └──────┬──────────┬───────┬───────┘
                           │          │       │
              per-tenant routing       │       │
                           │          │       │
               ┌───────────▼─┐  ┌─────▼──┐  ┌▼────────┐
               │  Etendo A   │  │Etendo B│  │Etendo C │
               │ client-a    │  │client-b│  │client-c │
               │ (26Q1)      │  │(26Q1)  │  │(26Q1)   │
               └─────────────┘  └────────┘  └─────────┘
```

### Tenant Configuration

Each tenant is defined in a config file (or environment variables).
The Orchestration Layer loads tenant configs at startup and routes requests accordingly.

```json
// tenants/client-a.json
{
  "tenantId": "client-a",
  "displayName": "Acme Corp",
  "etendo": {
    "baseUrl": "https://erp.acme.com",
    "version": "26Q1"
  },
  "auth": {
    "type": "basic"
  }
}
```

Tenant routing is resolved from:
1. `X-Tenant-ID` request header, or
2. Subdomain: `client-a.lite.mycompany.com` → tenant `client-a`

Both strategies are supported and configurable.

### Auth

- **v1:** Basic Auth pass-through — credentials provided by the user are forwarded directly to Etendo
- **v2:** JWT issued by the Orchestration Layer; internally uses a per-tenant Etendo service account
- The Orchestration Layer's public interface is identical in both versions (change is internal)
- Auth type is configurable per tenant

---

## Reverse Engineering Tool

To objectively understand what Etendo does in each operation (config and execution),
a recording and analysis tool is built first.

### Component 1: Recorder

**Purpose:** Record real operator sessions using the full Etendo UI.

**How it works:**
- JS script injected into the browser intercepts `window.fetch`
- Operator starts a recording before executing an operation
- All calls are logged (method, URL, payload, response, timestamp)
- Operator stops the recording when done
- Output: `.session.json` files classified by operation and phase

**Applies to both phases:**
- Record session "configure price list" → Phase A
- Record session "create sales invoice" → Phase B

**Session output format:**
```json
{
  "operation": "create_sales_invoice",
  "phase": "execution",
  "etendo_version": "26Q1",
  "recorded_at": "2026-02-19T10:00:00Z",
  "calls": [
    {
      "seq": 1,
      "method": "POST",
      "url": "/etendo/org.openbravo.service.json.jsonrest/Order",
      "request_headers": {},
      "request_payload": {},
      "response_status": 200,
      "response_body": {},
      "duration_ms": 142
    }
  ]
}
```

### Component 2: Analyzer

**Purpose:** Convert recordings into executable specs.

**How it works:**
- Loads multiple recordings of the same operation
- Filters noise: polling, heartbeats, asset requests, auth refresh
- Identifies fixed vs dynamic fields in payloads
- Detects intermediate value captures (generated IDs used in subsequent steps)
- Produces one spec per operation

**Output:** `specs/phase_a/configure_price_list.spec.json`
```json
{
  "operation": "configure_price_list",
  "phase": "setup",
  "etendo_version": "26Q1",
  "steps": [
    {
      "seq": 1,
      "method": "POST",
      "endpoint": "/etendo/org.openbravo.service.json.jsonrest/PriceList",
      "payload_template": {
        "name": "{{name}}",
        "currency": "{{currencyId}}",
        "salesPriceList": true
      },
      "capture": {
        "priceListId": "response.data.id"
      }
    },
    {
      "seq": 2,
      "method": "POST",
      "endpoint": "/etendo/org.openbravo.service.json.jsonrest/PriceListVersion",
      "payload_template": {
        "priceList": "{{priceListId}}",
        "validFromDate": "{{today}}"
      }
    }
  ]
}
```

### Component 3: DB Differ (complementary)

**Purpose:** Understand what changes in the DB per operation (validation and discovery).

**How it works:**
- Snapshot of relevant tables before the operation
- Snapshot after
- Diff by table / row / field
- Excludes known noise tables: `ad_session`, `ad_alertrecipient`, audit logs, `c_acct_*`

**Use:** Validate that the recorded sequence produces the correct DB state. Not part of the runtime.

---

## Orchestration Layer — API Contract

All endpoints are tenant-scoped. The tenant is resolved from the `X-Tenant-ID` header
or from the subdomain. No tenant identifier appears in the URL path.

### Tenant Management (admin only)

```
GET    /admin/tenants                      → list all tenants
POST   /admin/tenants                      → register new tenant + Etendo connection
GET    /admin/tenants/:tenantId            → get tenant config
PUT    /admin/tenants/:tenantId            → update tenant config (e.g. new Etendo URL)
DELETE /admin/tenants/:tenantId            → remove tenant
GET    /admin/tenants/:tenantId/ping       → test connectivity to tenant's Etendo instance
```

### Phase A1: Technical Configuration

```
GET  /lite/setup/status                    → onboarding progress (what's done, what's missing)
POST /lite/setup/organization              → create org (3 fields)
POST /lite/setup/warehouse                 → create warehouse (or auto with org)
POST /lite/setup/document-types            → initialize with sales + purchase defaults
POST /lite/setup/taxes                     → configure from country template
POST /lite/setup/price-lists               → create sales or purchase price list
POST /lite/setup/payment-terms             → create payment terms
POST /lite/setup/payment-methods           → configure payment methods
```

### Phase A2: Master Data

```
# Products
GET  /lite/masters/products                → list / search
POST /lite/masters/products                → create individual product
POST /lite/masters/products/import         → bulk import from CSV (fixed template)
GET  /lite/masters/products/template       → download CSV template

# Customers
GET  /lite/masters/customers               → list / search
POST /lite/masters/customers               → create individual customer
POST /lite/masters/customers/import        → bulk import from CSV (fixed template)
GET  /lite/masters/customers/template      → download CSV template

# Vendors
GET  /lite/masters/vendors                 → list / search
POST /lite/masters/vendors                 → create individual vendor
POST /lite/masters/vendors/import          → bulk import from CSV (fixed template)
GET  /lite/masters/vendors/template        → download CSV template
```

### Phase B: Operations

```
# Sales
POST /lite/sales/orders                    → create order
GET  /lite/sales/orders/:id                → get order
POST /lite/sales/orders/:id/complete
POST /lite/sales/invoices                  → create from order
POST /lite/sales/invoices/:id/complete
GET  /lite/sales/invoices                  → list

# Purchases
POST /lite/purchases/orders                → create order
GET  /lite/purchases/orders/:id            → get order
POST /lite/purchases/orders/:id/complete
POST /lite/purchases/invoices              → create from order
POST /lite/purchases/invoices/:id/complete
GET  /lite/purchases/invoices              → list
```

### Unified Error Model

Etendo returns errors differently depending on the endpoint.
The Orchestration Layer normalizes everything:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Customer has no price list assigned",
  "etendo_detail": "...(optional, for debugging)..."
}
```

---

## Etendo Lite UI — Scope v1

**Technology:** React

**Principles:**
- One flow per screen, no nested tabs
- Validate before submitting (don't discover Etendo errors on the last step)
- Explicit states: draft / processing / completed / error
- No ERP jargon where avoidable

**Screens:**
```
/login
/onboarding                           → overall setup progress
  /onboarding/config                  → A1 wizard: technical config (8 sequential steps)
  /onboarding/masters                 → A2 hub
    /onboarding/masters/products      → table + single entry form + CSV import
    /onboarding/masters/customers     → table + single entry form + CSV import
    /onboarding/masters/vendors       → table + single entry form + CSV import

/dashboard                            → system status + quick actions (only if onboarding complete)

/sales/invoices                       → list
/sales/invoices/new                   → wizard: customer → product lines → confirm
/sales/invoices/:id                   → detail

/purchases/invoices                   → list
/purchases/invoices/new               → wizard: vendor → product lines → confirm
/purchases/invoices/:id               → detail
```

### CSV Templates

Fixed-column templates downloadable from each import screen.

**products_template.csv**
```
sku, name, description, tax_category, unit_of_measure, sales_price, purchase_price
```

**customers_template.csv**
```
name, tax_id, email, phone, address, city, country, payment_terms, price_list
```

**vendors_template.csv**
```
name, tax_id, email, phone, address, city, country, payment_terms, price_list
```

---

## Work Plan

### Phase 0: Setup and recording (2 days)
- Stand up Etendo 26Q1 with demo data
- Implement Recorder (JS script)
- Record each operation 3 times: A1 (technical config), A2 (master data), B (sales and purchases)

### Phase 1: Analysis (2 days)
- Implement Analyzer
- Produce specs for all operations (A1, A2, B)
- Manual review + DB Differ validation

### Phase 2: Orchestration Layer MVP (4-5 days)
- Spec runner (executes sequences)
- Basic Auth pass-through
- A1 endpoints: technical config
- A2 endpoints: master data + CSV import
- B endpoints: sales + purchases
- Error normalization

### Phase 3: UI MVP (6-8 days)
- /onboarding: A1 wizard + A2 master data hub (with CSV import)
- /sales and /purchases: invoicing flows
- Orchestration Layer integration
- Guard: redirect to /onboarding if setup is incomplete

---

## Success Criteria v1

- From zero (unconfigured Etendo) to first sales invoice: < 30 minutes including master data loading
- From zero to first purchase invoice: < 30 minutes including master data loading
- Bulk import of 100 products from CSV: < 5 minutes
- A user with no ERP knowledge can complete the full onboarding without assistance
- The Etendo backend requires no modifications

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Etendo changes its API in updates | High | Specs versioned per Etendo version |
| Call sequence has conditional branches based on data | Medium | Record multiple variants; conditional logic in the runner |
| Required fields not obvious from the UI | Medium | DB differ reveals mandatory fields |
| Phase A1 config has hidden dependencies | High | Record in correct order; Analyzer detects inter-step ID dependencies |
| Etendo error messages are not descriptive | Low | Normalization in Orchestration Layer + known error map |

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Etendo version | 26Q1 |
| Auth v1 | Basic Auth pass-through |
| Auth v2 | JWT (extensible, same interface) |
| Orchestration technology | Node.js + Express |
| UI technology | React |
| Reimplement business logic | No |
| CSV import format | Fixed downloadable template per entity |
| Products created from | Etendo Lite (not from original ERP) |
| Orchestration Layer deployment | Separate server from Etendo |
| Multi-tenancy model | One tenant per client; each tenant points to its own Etendo instance |
| Tenant routing | Configurable: `X-Tenant-ID` header or subdomain |
| Tenant config | Config file or env vars, loaded at startup |

## Resolved Decisions (continued)

| Decision | Resolution |
|---|---|
| Tenant config storage | JSON files — one file per tenant in `tenants/` directory |
| Admin API auth | Own auth layer (JWT), separate from tenant user auth |

### Tenant Config File Structure

```
orchestration-layer/
└── tenants/
    ├── client-a.json
    ├── client-b.json
    └── client-c.json
```

The Orchestration Layer watches the `tenants/` directory for changes (hot reload).
Adding or updating a tenant JSON file takes effect without a server restart.

### Admin Auth Layer

The admin API (`/admin/*`) uses its own JWT-based auth, independent of tenant user auth.

```
POST /auth/admin/login    → returns admin JWT
POST /auth/admin/refresh  → refresh admin JWT
```

Admin credentials are stored in a separate `admin.json` config (hashed password).
The admin JWT is scoped to admin operations only — it cannot be used to call tenant endpoints.
