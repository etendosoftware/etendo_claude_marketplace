---
description: Interactive guide for creating a new flow in the Etendo headless API (etapi_openapi_flow + flowpoint + req + tab + fields). Use this skill when the user wants to create or configure headless API endpoints/flows in Etendo.
argument-hint: "<flow-name>"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
---

First, read `skills/etendo-_guidelines/SKILL.md` and `skills/etendo-_context/SKILL.md` to resolve the active module and DB connection.

For the full EtendoRX API reference and endpoint configuration, read `references/etendo-headless.md`.
For the complete data model and SQL templates, read `references/headless-flow-guide.md`.

You are an expert in the Etendo headless API (EtendoRX). The user wants to create a new flow. Your task is to guide them step by step and execute the necessary SQL queries.

## Argument context

The user provided: `$ARGUMENTS`

If there is no argument, ask: "What is the flow name? (e.g., 'Inventory', 'SalesReturn')"

---

## What is a Flow in Etendo Headless

The data structure is (creation order matters):

```
etapi_openapi_flow          → Tag/group name for the OpenAPI docs
  etapi_openapi_flowpoint   → Links flow ↔ req + HTTP method flags
    etapi_openapi_req       → Endpoint definition (name = URL segment, type = ETRX_Tab | SMFWHE_WBHK)
      etrx_openapi_tab      → Links req ↔ ad_tab (1:1, FK lives here)
        etrx_openapi_field  → Each field to expose from the tab
```

URLs:
- CRUD: `/etendo/sws/com.etendoerp.etendorx.datasource/{req.name}`
- Webhook: `/etendo/sws/com.etendoerp.etendorx.datasource/{req.name}?param1=val1`
- Docs: `GET /etendo/ws/com.etendoerp.openapi.openAPIController?tag={flow.name}`

### Schema Gotchas

| Expected (from old docs) | Actual (in DB) |
|---|---|
| `etrx_openapi_tab.name` | **Does NOT exist** |
| `etrx_openapi_field.name` | **Does NOT exist** — name comes from `ad_field` |
| `etapi_openapi_req.etrx_openapi_tab_id` | **Reversed** — FK is on `etrx_openapi_tab.etapi_openapi_req_id` |
| `isget`, `ispost`, `isput`, `isgetbyid` | Actual columns: **`get`**, **`post`**, **`put`**, **`getbyid`** |

### Req Types

| `type` value | Meaning | Linked via |
|---|---|---|
| `ETRX_Tab` | CRUD endpoint backed by an AD tab | `etrx_openapi_tab` |
| `SMFWHE_WBHK` | Webhook endpoint (custom Java logic) | `smfwhe_openapi_webhk` |

---

## Step 1 — Identify the ERP Tab

We need to know which `ad_tab` from the ERP we want to expose. When the same table backs multiple windows (e.g., `C_Order` in Sales Order vs Sales Quotation), the `ad_tab_id` determines which window's callouts and defaults apply. Search including the window name:

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "SELECT t.ad_tab_id, t.name, tb.tablename, w.name as window_name
   FROM ad_tab t
   JOIN ad_table tb ON t.ad_table_id = tb.ad_table_id
   JOIN ad_window w ON t.ad_window_id = w.ad_window_id
   WHERE lower(t.name) LIKE lower('%$ARGUMENTS%')
      OR lower(w.name) LIKE lower('%$ARGUMENTS%')
   ORDER BY w.name, t.seqno LIMIT 20;"
```

Show the results to the user and ask them to confirm which `ad_tab_id` to use.
If the user already knows the tab ID, continue directly.

---

## Step 2 — Identify available fields

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "SELECT f.ad_field_id, f.name, c.columnname, c.ad_reference_id
   FROM ad_field f
   JOIN ad_column c ON f.ad_column_id = c.ad_column_id
   WHERE f.ad_tab_id = '<TAB_ID>'
     AND f.isactive = 'Y'
   ORDER BY f.seqno LIMIT 50;"
```

Ask the user which fields they want to expose. Recommend exposing only fields that:
- **Are required for creation** (e.g., `businessPartner`, `product`)
- **Are user-provided** — not auto-completed by callouts (skip `priceList`, `paymentTerms`, `warehouse`, `partnerAddress`, `currency`, `UOM`, `tax`)
- **Are not calculated** (skip `lineNetAmount`, `grandTotal`, `docStatus`)
- **The user might want to override** (e.g., `netUnitPrice`)

---

## Step 3 — Check if an etrx_openapi_tab already exists for this tab

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "SELECT etrx_openapi_tab_id, etapi_openapi_req_id
   FROM etrx_openapi_tab WHERE ad_tab_id = '<TAB_ID>';"
```

If it already exists, the endpoint is already partially configured. Check if it belongs to the correct module. If not, create new records in the following steps.

---

## Step 4 — Create the endpoint (etapi_openapi_req) FIRST

The `etapi_openapi_req` must be created before the tab because the FK lives on `etrx_openapi_tab`. The `type` column is **NOT NULL**.

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "INSERT INTO etapi_openapi_req (
     etapi_openapi_req_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     name, type, ad_module_id,
     description, post_description, put_description
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '0', NOW(), '0',
     '<EndpointName>', 'ETRX_Tab', '<AD_MODULE_ID>',
     '<general description>',
     '<POST description with example JSON>',
     '<PUT description>'
   ) RETURNING etapi_openapi_req_id;"
```

`name` is the URL segment: `/etendo/sws/com.etendoerp.etendorx.datasource/<EndpointName>`

---

## Step 5 — Create the etrx_openapi_tab (link to AD tab)

The FK `etapi_openapi_req_id` is on this table (unique constraint). **No `name` column exists.**

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "INSERT INTO etrx_openapi_tab (
     etrx_openapi_tab_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     ad_tab_id, etapi_openapi_req_id, ad_module_id
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '0', NOW(), '0',
     '<AD_TAB_ID>', '<ETAPI_OPENAPI_REQ_ID>', '<AD_MODULE_ID>'
   ) RETURNING etrx_openapi_tab_id;"
```

---

## Step 6 — Expose fields (etrx_openapi_field)

For each field the user wants to expose. **No `name` column** — the API name comes from the `ad_field`.

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "INSERT INTO etrx_openapi_field (
     etrx_openapi_field_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     etrx_openapi_tab_id, ad_field_id, ad_module_id,
     description, seqno
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '0', NOW(), '0',
     '<ETRX_OPENAPI_TAB_ID>', '<AD_FIELD_ID>', '<AD_MODULE_ID>',
     '<description for AI/docs>', <SEQNO>
   );"
```

Repeat for each field.

---

## Step 7 — Create the Flow

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "INSERT INTO etapi_openapi_flow (
     etapi_openapi_flow_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     name, description, ad_module_id
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '0', NOW(), '0',
     '<FlowName>', '<Flow description>', '<AD_MODULE_ID>'
   ) RETURNING etapi_openapi_flow_id;"
```

---

## Step 8 — Link endpoint to the Flow (etapi_openapi_flowpoint)

**IMPORTANT:** Column names are `get`, `post`, `put`, `getbyid` — NOT `isget`, `ispost`, etc.

```bash
docker exec etendo-db-1 psql -U {bbdd.user} -d {bbdd.sid} -c \
  "INSERT INTO etapi_openapi_flowpoint (
     etapi_openapi_flowpoint_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     etapi_openapi_flow_id, etapi_openapi_req_id, ad_module_id,
     get, post, put, getbyid
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '0', NOW(), '0',
     '<FLOW_ID>', '<REQ_ID>', '<AD_MODULE_ID>',
     'Y', 'Y', 'Y', 'Y'
   );"
```

Adjust the HTTP flags based on what the flow needs:
- `get` → `GET /endpoint` (list)
- `getbyid` → `GET /endpoint/{id}` (get by ID)
- `post` → `POST /endpoint` (create)
- `put` → `PUT /endpoint/{id}` (update)

**Always add SimSearch** to the flow so agents can search by name instead of IDs:
```sql
-- Find existing SimSearch req ID:
SELECT etapi_openapi_req_id FROM etapi_openapi_req WHERE name = 'SimSearch';
-- Then add a flowpoint with get='Y', getbyid='Y', post='N', put='N'
```

---

## Step 8b — Add webhook endpoints to the flow (if needed)

Webhooks require 3 records to appear in the flow:

1. **`smfwhe_definedwebhook`** — Java class + name
2. **`etapi_openapi_req`** with `type = 'SMFWHE_WBHK'` — OpenAPI endpoint
3. **`smfwhe_openapi_webhk`** — links webhook ↔ req

Plus `smfwhe_definedwebhook_param` for parameters and `smfwhe_definedwebhook_role` for access.

See `references/headless-flow-guide.md` "Adding a Webhook endpoint to a flow" section for the full SQL template.

**All records need `ad_module_id` set or they won't be exported.**

---

## Step 9 — Verify

1. Get JWT — use System Administrator (role `"0"`) for admin operations:
```bash
ETENDO_TOKEN=$(curl -s -X POST "${ETENDO_URL}/sws/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"0"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
```

2. Verify generated docs:
```bash
curl -s "${ETENDO_URL}/ws/com.etendoerp.openapi.openAPIController?tag=<FlowName>" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" | python3 -m json.tool
```

3. Test GET:
```bash
curl -s "${ETENDO_URL}/sws/com.etendoerp.etendorx.datasource/<EndpointName>" \
  -H "Authorization: Bearer ${ETENDO_TOKEN}" | python3 -m json.tool
```

4. Verify all flow endpoints:
```sql
SELECT r.name as endpoint, r.type, fp.get, fp.post, fp.put, fp.getbyid
FROM etapi_openapi_flowpoint fp
JOIN etapi_openapi_flow f ON f.etapi_openapi_flow_id = fp.etapi_openapi_flow_id
JOIN etapi_openapi_req r ON fp.etapi_openapi_req_id = r.etapi_openapi_req_id
WHERE f.name = '<FlowName>'
ORDER BY r.name;
```

---

## Common troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `type` NOT NULL violation | Missing `type` on req INSERT | Add `type = 'ETRX_Tab'` or `'SMFWHE_WBHK'` |
| Record not exported | `ad_module_id` is NULL | Set it on ALL records |
| `404` on endpoint | `name` in `etapi_openapi_req` doesn't match URL | Verify name spelling |
| `AccessTableNoView` | Role `0` (System Admin) doesn't have access to business data | Use a business role in the JWT |
| `ActionNotAllowed` on PUT | Tab doesn't support update via headless | Check tab configuration in ERP |
| Missing fields in response | Field not added in `etrx_openapi_field` | Add the missing field |
| POST returns 200 but doesn't persist | Silent rollback due to callout error | Check Tomcat logs: `docker logs etendo-tomcat-1 \| grep ERROR` |
| Webhook not in flow | Missing `etapi_openapi_req` + `smfwhe_openapi_webhk` | Create req (type=SMFWHE_WBHK) + link record |

---

## Summary of involved tables

```sql
-- View all configured flows
SELECT f.name as flow, r.name as endpoint, r.type,
       fp.get, fp.post, fp.put, fp.getbyid
FROM etapi_openapi_flow f
JOIN etapi_openapi_flowpoint fp ON f.etapi_openapi_flow_id = fp.etapi_openapi_flow_id
JOIN etapi_openapi_req r ON fp.etapi_openapi_req_id = r.etapi_openapi_req_id
ORDER BY f.name, r.name;
```
