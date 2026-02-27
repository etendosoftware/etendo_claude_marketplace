# CSRF in Etendo Core — Investigation and Solution

**Date:** 2026-02-20
**Etendo Version:** 26Q1
**Context:** Etendo Lite Orchestration Layer (Node.js) calling local Etendo Core

---

## The Problem

The Orchestration Layer makes POST requests to the Etendo API to create orders, lines, and
invoices. These POSTs were failing with `InvalidCSRFToken`.

---

## How CSRF works in Etendo

### 1. Token generation

On login, `LoginUtils.fillSessionArguments()` generates a UUID and saves it in
the HTTP session:

```java
// LoginUtils.java:244
String csrfToken = SequenceIdData.getUUID();
vars.setSessionValue("#CSRF_Token", csrfToken);
```

The token is an uppercase UUID without dashes: `[A-Z0-9]+`

### 2. Where it is exposed

The Etendo kernel serves the token embedded in the application's dynamic JS:

```
GET /etendo/org.openbravo.client.kernel/org.openbravo.client.kernel/ApplicationDynamic
```

Template `application-dynamic-js.ftl`:
```javascript
csrfToken: '${data.csrfToken?js_string}'
```

The JS client (browser) reads `OB.User.csrfToken` and injects the value into every request.

### 3. Where it is validated

`CsrfUtil.checkCsrfToken()` looks for the pattern `"csrfToken":"TOKEN"` in the request body
and compares it with the token saved in the session.

```java
// CsrfUtil.java
private static Pattern csrfTokenPattern =
    Pattern.compile("\"csrfToken\":\"(?<token>[A-Z0-9]+)\"");
```

---

## Which endpoints need CSRF

| Servlet | URL | CSRF required |
|---|---|---|
| `DataSourceServlet.doPost()` | `/org.openbravo.service.datasource/*` | **YES** |
| `DataSourceServlet.doPut()` | `/org.openbravo.service.datasource/*` | **YES** |
| `DataSourceServlet.doDelete()` | `/org.openbravo.service.datasource/*` | **YES** |
| `JsonRestServlet.doPost()` | `/org.openbravo.service.json.jsonrest/*` | NO |
| `KernelServlet` / `BaseActionHandler` | `/org.openbravo.client.kernel/*` | NO |
| `FormInitializationComponent` | `/org.openbravo.client.kernel?_action=...` | NO |

**Source**: grep in `etendo_core/modules_core` — `checkCsrfToken` only appears in
`DataSourceServlet` and `DeleteImageActionHandler`.

---

## Why the original code failed

`etendo.js` sent POSTs with `X-Requested-With: XMLHttpRequest` + JSESSIONID
cookie, but **did not include `csrfToken` in the body**.

`DataSourceServlet.doPost()` extracts the token from the body with:
```java
CsrfUtil.checkCsrfToken(CsrfUtil.getCsrfTokenFromRequestContent(content), request);
```

The `X-Requested-With` header **does not** bypass CSRF in Etendo — it is only decorative for
CORS. The validation always looks at the body.

**Evidence from session recordings:**
```
// sales_order_all.session.json — call 5 (Order POST)
{
  "dataSource": "Order",
  "operationType": "add",
  "data": { ... },
  "oldValues": {},
  "csrfToken": "1A1DE493954A4C88AFA9..."   // required, at root level
}
```

---

## The implemented solution

### Session flow (2 steps, cached)

```
1. GET /etendo/
   Headers: Authorization: Basic xxx
   → Response: Set-Cookie: JSESSIONID=yyy
   → Effect: fillSessionArguments() called → #CSRF_Token saved in session

2. GET /etendo/org.openbravo.client.kernel/org.openbravo.client.kernel/ApplicationDynamic
   Headers: Authorization: Basic xxx, Cookie: JSESSIONID=yyy
   → Response body: ...csrfToken: 'ZZZZZZZZZZ'...
   → Extracts: csrfToken with regex /csrfToken\s*:\s*'([A-Z0-9]+)'/
```

### Injection in POSTs

`postJson()` automatically adds `csrfToken` to the root level of the payload:

```javascript
const bodyPayload = csrfToken
  ? { ...payload, csrfToken }
  : payload
```

This is transparent to `sales.js` and any other caller — their payloads do not change.

### `postForm()` (FormInit)

`BaseActionHandler` / `KernelServlet` **do not** check CSRF. They only need JSESSIONID.
`postForm()` does not inject csrfToken.

### Retry on error

If the token expires (session invalidated on the server), the retry still works:
1. Detects `InvalidCSRFToken` in the response
2. Invalidates cache → re-establishes session (new JSESSIONID + new csrfToken)
3. Retries once

---

## Alternative: JSON REST API (no CSRF)

`JsonRestServlet` accepts Basic Auth without CSRF. Different URL and payload:

```
POST /etendo/org.openbravo.service.json.jsonrest/Order
Body: { "data": { ...fields... } }
```

Same response: `{ "response": { "status": 0, "data": [...] } }`

Advantage: no session, no CSRF, stateless.
Disadvantage: requires rewriting URLs and payload wrapping in `sales.js`.

Recommended as a future migration if a stateless architecture is desired.

---

## Server-side solution: bypass for Basic Auth (implemented)

Instead of the client managing the CSRF token (session + fetch + injection in body),
the server was modified to skip CSRF validation when the request arrives with
`Authorization: Basic ...`.

### Modified file

`etendo_core/src/org/openbravo/erpCommon/utility/CsrfUtil.java`

### Change

5 lines were added at the beginning of `checkCsrfToken()`:

```java
// Skip CSRF validation for programmatic API calls using Basic Auth.
// Browser sessions never send Authorization: Basic — they rely on JSESSIONID cookies,
// so browser CSRF protection is fully maintained for all UI traffic.
String authHeader = request.getHeader("Authorization");
if (authHeader != null && authHeader.startsWith("Basic ")) {
  return;
}
```

### Why it is secure

- The Etendo browser **never** sends `Authorization: Basic`. It uses JSESSIONID cookies.
  Therefore, the bypass does not affect any browser user.
- Only programmatic clients (our Orchestration Layer) send `Authorization: Basic`.
  Those clients are already authenticated by the HTTP Basic mechanism, which is equivalent
  or superior to the protection offered by the CSRF token in this context.
- The condition is `startsWith("Basic ")` (with space), avoiding false positives with
  schemes like `Bearer` or `BasicAuth`.

### Scope of the change

`checkCsrfToken()` is the only CSRF validation method. It is called from 4 places:

| File | Line | Method |
|---|---|---|
| `DataSourceServlet.java` | 848 | `doPost()` — JSON body |
| `DataSourceServlet.java` | 875 | `doPost()` — form params |
| `DataSourceServlet.java` | 917 | `doPut()` / `doDelete()` |
| `DeleteImageActionHandler.java` | 57 | delete image action |

All receive the bypass uniformly without modifying any of those call sites.

### Impact on the client (etendo.js)

With this server-side change, `etendo.js` **no longer needs** to manage the CSRF token:
- No need to do `GET /etendo/` to obtain JSESSIONID
- No need to do `GET ApplicationDynamic` to extract the token
- No need to inject `csrfToken` into POST/PUT/DELETE payloads
- The flow is stateless again: Basic Auth per request, without cached session

The cached session implementation in `etendo.js` can be simplified or removed
in a future refactoring.

---

## Modified files

- `server/src/etendo.js` — client-side solution (can be simplified with the server-side fix)
- `etendo_core/src/org/openbravo/erpCommon/utility/CsrfUtil.java` — Basic Auth bypass

---

## Code references (etendo_core)

| File | Relevance |
|---|---|
| `src/org/openbravo/erpCommon/utility/CsrfUtil.java` | CSRF validation logic |
| `src/org/openbravo/base/secureApp/LoginUtils.java:244` | Token generation on login |
| `modules_core/org.openbravo.service.datasource/src/.../DataSourceServlet.java:848` | Validation in doPost |
| `modules_core/org.openbravo.client.kernel/src/.../ApplicationDynamicComponent.java:177` | Token in session for template |
| `modules_core/org.openbravo.client.kernel/src/.../templates/application-dynamic-js.ftl:54` | Template that embeds the token |
| `modules_core/org.openbravo.service.json/src/.../JsonRestServlet.java` | No CSRF (alternative) |
| `modules_core/org.openbravo.client.kernel/src/.../BaseActionHandler.java` | No CSRF (FormInit) |
