# EtendoRX Headless API

## Overview

Module `com.etendoerp.etendorx` provides a configurable REST API layer for Etendo ERP. It allows associating a Tab to an HTTP endpoint with control over which fields are exposed. Built on top of the `/sws/` Secure Web Services layer.

Source: `etendo_core/modules/com.etendoerp.etendorx`

## Core Concepts

| DB Table | Purpose |
|----------|---------|
| `etapi_openapi_flow` | Groups related endpoints into a tag for OpenAPI docs |
| `etapi_openapi_flowpoint` | Links flow ↔ req + HTTP method flags (`get`, `post`, `put`, `getbyid`) |
| `etapi_openapi_req` | Defines the HTTP endpoint (`name` = URL segment, `type` = `ETRX_Tab` or `SMFWHE_WBHK`) |
| `etrx_openapi_tab` | Maps a Tab (e.g. `C_Order`) to an endpoint. FK `etapi_openapi_req_id` lives here (not on req) |
| `etrx_openapi_field` | Configures which fields are exposed. No `name` column — API name comes from `ad_field` |

For webhook-type endpoints (`SMFWHE_WBHK`), the req links via `smfwhe_openapi_webhk` instead of `etrx_openapi_tab`.

For the complete data model, creation order, and SQL templates, see `docs/headless-flow-guide.md`.

## API Endpoints

Base path:

```
/sws/com.etendoerp.etendorx.datasource/{EndpointName}
```

| Method | Path | Description |
|--------|------|-------------|
| GET | `/{EndpointName}` | List records. Supports `q` (RSQL filter), `_startRow`, `_endRow` |
| GET | `/{EndpointName}/{id}` | Single record by ID |
| POST | `/{EndpointName}` | Create record. Only send fields to set; backend fills defaults |
| PUT | `/{EndpointName}` | Update record. PATCH-like: only send changed fields |

Auto-generated docs:
```
GET /etendo/ws/com.etendoerp.openapi.openAPIController?tag={flow.name}
```

## Authentication

### Basic Auth (POC/dev)

```
Authorization: Basic {base64(user:password)}
```

### JWT Bearer (production)

```
Authorization: Bearer {token}
```

Obtain a token:
```bash
ETENDO_TOKEN=$(curl -s -X POST "${ETENDO_URL}/sws/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"0"}' \
  | python3 -c "import sys,json; data=json.loads(sys.stdin.buffer.read().decode('utf-8','replace')); print(data.get('token',''))")
```

JWT claims: `user`, `role`, `organization`, `warehouse`, `client`, `jti`

Both auth methods work on the same endpoints with the same code. No URL or configuration changes needed when migrating from Basic to JWT.

## CSRF Handling

CSRF is a non-issue for EtendoRX Headless callers regardless of auth method:

**Basic Auth requests:** The `DataSourceServlet` hardcodes the CSRF token internally:
- Sets `session["#CSRF_TOKEN"] = "123"`
- Injects `csrfToken: "123"` into the request params
- The delegated DataSourceServlet CSRF check passes (both values match)

**JWT Bearer requests:** Marked as stateless — no session created — CSRF check is never reached.

Result: callers never need to manage CSRF tokens.

## Query filter syntax (`q` parameter)

| Operator | Meaning | Example |
|---|---|---|
| `==` | Equals | `q=name==MyWebhook` |
| `=ic=` | Case-insensitive contains | `q=name=ic=webhook` |
| `=sw=` | Starts with | `q=name=sw=Sales` |
| `=ge=` / `=le=` | Greater/less than or equal | `q=created=ge=2024-01-01` |

## Configuring an Endpoint

**Creation order matters** (see `docs/headless-flow-guide.md` for full SQL):

1. Create `etapi_openapi_req` — `name` becomes URL segment, `type` is NOT NULL (`ETRX_Tab` or `SMFWHE_WBHK`)
2. Create `etrx_openapi_tab` — links req to an AD Tab (FK `etapi_openapi_req_id` is here)
3. Create `etrx_openapi_field` entries — no `name` column, API name comes from `ad_field`
4. Create `etapi_openapi_flow` — grouping tag
5. Create `etapi_openapi_flowpoint` — HTTP flags are `get`, `post`, `put`, `getbyid` (NOT `isget`)

**Critical:** Set `ad_module_id` on ALL records or `export.database` will silently skip them.

## Applicable Tabs

- `C_Order` — Sales and Purchase orders (different tabs per window)
- `C_OrderLine` — Order lines
- `C_Invoice` — Invoices
- `C_InvoiceLine` — Invoice lines
- `C_BPartner` — Business Partners
- `M_Product` — Products
- Any other standard or custom Tab

**Important:** When the same table backs multiple windows, use the specific window's tab. The `ad_tab_id` determines which callouts and defaults apply.

## Key Source Files

| File | Purpose |
|------|---------|
| `src/com/etendoerp/etendorx/services/DataSourceServlet.java` | Main request handler |
| `src/com/etendoerp/etendorx/auth/SWSAuthenticationManager.java` | JWT authentication |
| `src/com/etendoerp/etendorx/auth/JwkRSAKeyProvider.java` | RSA key provider |
| `src/com/etendoerp/etendorx/utils/TokenVerifier.java` | Token validation |
| `src/com/etendoerp/etendorx/openapi/DynamicDatasourceEndpoint.java` | OpenAPI docs generation |
