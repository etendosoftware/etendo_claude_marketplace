# EtendoRX Headless API

## Overview

Module `com.etendoerp.etendorx` provides a configurable REST API layer for Etendo ERP. It allows associating a Tab to an HTTP endpoint with control over which fields are exposed. Built on top of the `/sws/` Secure Web Services layer.

Source: `etendo_core/modules/com.etendoerp.etendorx`

## Core Concepts

| Entity | Purpose |
|--------|---------|
| `ETRX_Projection` | Groups related endpoints |
| `OpenAPIRequest` | Defines the HTTP endpoint (name becomes URL segment) |
| `ETRX_OpenAPI_Tab` | Maps a Tab (e.g. C_Order) to an OpenAPI endpoint |
| `ETRX_Entity_Field` | Configures which fields are exposed on the endpoint |

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

## Authentication

### Basic Auth (POC/dev)

```
Authorization: Basic {base64(user:password)}
```

### JWT Bearer (production)

```
Authorization: Bearer {token}
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

## Configuring an Endpoint

1. Open Etendo ERP UI, navigate to **EtendoRX / OpenAPI configuration**
2. Create an `OpenAPIRequest` — the name becomes the endpoint URL segment
3. Create `ETRX_OpenAPI_Tab` entries — link the request to a Tab (e.g. `C_Order`)
4. Create `ETRX_Entity_Field` entries — specify which fields to expose
5. Endpoint is available at `/sws/com.etendoerp.etendorx.datasource/{RequestName}`

## Applicable Tabs

- `C_Order` — Sales and Purchase orders
- `C_OrderLine` — Order lines
- `C_Invoice` — Invoices
- `C_InvoiceLine` — Invoice lines
- `C_BPartner` — Business Partners
- `M_Product` — Products
- Any other standard or custom Tab

## Key Source Files

| File | Purpose |
|------|---------|
| `src/com/etendoerp/etendorx/services/DataSourceServlet.java` | Main request handler |
| `src/com/etendoerp/etendorx/auth/SWSAuthenticationManager.java` | JWT authentication |
| `src/com/etendoerp/etendorx/auth/JwkRSAKeyProvider.java` | RSA key provider |
| `src/com/etendoerp/etendorx/utils/TokenVerifier.java` | Token validation |
| `src/com/etendoerp/etendorx/openapi/DynamicDatasourceEndpoint.java` | OpenAPI docs generation |
