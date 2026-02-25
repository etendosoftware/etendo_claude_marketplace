# Etendo Lite — Architecture

**Date:** 2026-02-20
**Status:** In development

---

## Overview

Etendo Lite is a simplified UI + orchestration layer on top of Etendo ERP.
It does not reimplement business logic — the Etendo backend continues doing all the work.

```
  Browser (React UI)
        │
        │ REST + Basic Auth
        ▼
  Orchestration Layer  (Node.js / Express)   ← etendo-lite/server/
        │
        │ DataSource API / FormInit / JSON REST API
        │ + session management + CSRF handling
        ▼
  Etendo Core (26Q1)                          ← etendo-lite/etendo_core/
  (Tomcat / PostgreSQL)
```

---

## Components

### `server/` — Orchestration Layer

```
src/
├── index.js          - Express app, middleware, routes
├── etendo.js         - HTTP client for Etendo (session, CSRF, GET/POST)
├── tenants.js        - Load per-tenant configuration
└── routes/
    ├── sales.js      - POST /lite/sales/orders (create + complete order)
    └── masters.js    - GET /lite/masters/customers/search, etc.
```

**Responsibilities:**
- Translate simple calls (customerId + lines) into sequences of N calls to Etendo
- Manage HTTP session + CSRF token
- Normalize Etendo errors
- Route by tenant (`X-Tenant-ID` header or subdomain)

### `ui/` — React frontend

```
src/
├── App.tsx
├── main.tsx
└── pages/
    └── sales/
        └── CreateSalesOrder.tsx
```

### `reverse-engeneer/` — Analysis Tools

```
poc/
├── recorder.js       - Inject into browser to capture calls
├── sessions/         - Captured recordings
└── ANALYSIS.md       - Essential recordings analysis

pipeline/
├── analyzer.js       - Filters noise, identifies fixed/dynamic fields
├── generator.js      - Generates executable specs
└── index.js
```

---

## Flow: Create Sales Order

```
POST /lite/sales/orders
  { customerId, date, lines: [{productId, quantity}] }
          │
          ├── 1+2. GET Customer + GET CustomerLocation (headless, parallel)
          │         → priceList, paymentTerms, paymentMethod, partnerAddressId
          ├── 3. GET ProductByPriceAndWarehouse × N (classic GET, parallel)
          │         → unitPrice, uOM
          ├── 4. POST SalesOrder (headless) → orderId, documentNo
          ├── 5. POST SalesOrderLine × N (headless, parallel)
          └── 6. POST FormInit MODE=EDIT TAB=186 inpdocaction=CO → status CO
```

Steps 1-5: EtendoRX Headless — no CSRF, Basic Auth (→ JWT in production)
Step 6: Classic Kernel — requires JSESSIONID (no CSRF)

---

## CSRF Management

See `docs/csrf-investigation.md` for the full investigation and `docs/csrf-solution.md` for the architectural decision.

**Summary (current solution):**
- Steps 1-5 use EtendoRX Headless (`/etendo/sws/com.etendoerp.etendorx.datasource/{endpoint}`)
- The headless servlet handles CSRF internally — callers do not manage tokens
- Step 6 (FormInit CO) uses the classic kernel, which does not validate CSRF either
- Only `makeClient.postForm()` needs JSESSIONID (cached automatically)

---

## Tenant configuration

```json
// server/tenants/demo.json
{
  "tenantId": "demo",
  "etendoUrl": "http://localhost:8080",
  "organization": "...",
  "client": "...",
  "warehouse": "...",
  "salesOrderDocType": "...",
  "currency": "...",
  "userContactId": "...",
  "productSelectorId": "..."
}
```

---

## Technical decisions

| Decision | Chosen option | Discarded alternative |
|---|---|---|
| Etendo API for CRUD | EtendoRX Headless (no CSRF) | Classic DataSource API (needs CSRF) |
| CSRF handling | Not required (headless handles internally) | Token extraction from ApplicationDynamic |
| Authentication | Basic Auth (→ JWT Bearer in production) | JSESSIONID session cookie |
| Complete documents | FormInitializationComponent | No headless equivalent |
| Multi-tenancy | Config file per tenant | ENV vars |
| Endpoint config | SQL in DB (headless-setup.sql) | ERP UI |

---

## To-do

- [ ] Purchase routes (`/lite/purchases/orders`)
- [ ] Masters: search for customers, vendors, products
- [ ] Invoice flows (create invoice from order)
- [ ] UI: Quick Sale, Quick Purchase
- [ ] Onboarding wizard (Phase A)
- [ ] Tenant configuration in `server/tenants/`
