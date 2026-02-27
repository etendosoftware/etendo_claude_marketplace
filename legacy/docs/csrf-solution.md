# CSRF Architecture Decision

## The Problem

`DataSourceServlet.doPost()` validates the CSRF token on every write request. This blocks programmatic API calls that don't have a browser session to extract the token from.

## Why It Doesn't Apply to Us

Etendo exposes multiple API surfaces with different CSRF behavior:

| API | URL | CSRF | Auth |
|-----|-----|------|------|
| Browser DataSource | `/org.openbravo.service.datasource/*` | Required | Session cookie |
| EtendoRX Headless | `/sws/com.etendoerp.etendorx.datasource/*` | Bypassed internally | Basic or JWT |
| JSON REST | `/org.openbravo.service.json.jsonrest/*` | Not checked | Basic or JWT |
| SWS DataSource | `/sws/com.smf.securewebservices.datasource/*` | Bypassed for JWT | JWT only |

The Browser DataSource API is the only one that enforces CSRF. All `/sws/` and JSON REST endpoints either bypass or skip the check entirely.

## Chosen Path: EtendoRX Headless Endpoints

**Why this wins:**

- Works with Basic Auth (POC) **and** JWT (production) — same URL, same code
- CSRF internally handled: `DataSourceServlet` sets `session["#CSRF_TOKEN"]="123"` and injects `csrfToken` param `"123"` — check passes automatically
- For JWT Bearer: request is stateless, no session, CSRF check never reached
- Configurable field exposure per endpoint
- OpenAPI documentation built-in
- Zero modifications to Etendo Core

## Discarded Approaches

| Approach | Why Rejected |
|----------|-------------|
| Modify `CsrfUtil.java` to bypass for Basic Auth | Won't work for JWT. Requires core modification. |
| Client-side CSRF extraction (GET session + GET ApplicationDynamic) | Complex, fragile, two extra round-trips per request |
| Direct Browser DataSource API | Requires CSRF management, designed for browser use only |

## Migration Path

**POC (now):**
```
Authorization: Basic {base64(user:password)}
```

**Production (later):**
```
Authorization: Bearer {token}
```

Same endpoints. Same code. No changes needed.

## Impact on etendo.js

| Aspect | Current (Browser DataSource) | With EtendoRX Headless |
|--------|------------------------------|----------------------|
| Session management | Required (login + cookie) | Not needed |
| CSRF token extraction | Required (parse ApplicationDynamic) | Not needed |
| Auth header | None (cookie-based) | `Authorization: Basic ...` or `Bearer ...` on every request |
| Complexity | High | Low |

The existing session + CSRF extraction logic in `etendo.js` can be replaced with a single auth header on each request.

## Key Source Files

| File | Lines | What to look at |
|------|-------|----------------|
| `modules/com.etendoerp.etendorx/src/.../services/DataSourceServlet.java` | 162-164, 310-318 | CSRF token hardcoding and injection |
| `modules/com.etendoerp.etendorx/src/.../auth/SWSAuthenticationManager.java` | 328-368 | JWT auth and stateless marking |
| `modules_core/com.smf.securewebservices/src/.../service/BaseSecureWebServiceServlet.java` | 104-150 | SWS CSRF bypass for JWT |
| `src/org/openbravo/erpCommon/utility/CsrfUtil.java` | — | Core CSRF validation logic |
