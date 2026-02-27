---
description: Interactive guide for creating a new flow in the Etendo headless API (etapi_openapi_flow + flowpoint + req + tab + fields). Use this skill when the user wants to create or configure headless API endpoints/flows in Etendo.
argument-hint: "<flow-name>"
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
---

You are an expert in the Etendo headless API (EtendoRX). The user wants to create a new flow. Your task is to guide them step by step and execute the necessary SQL queries.

## Argument context

The user provided: `$ARGUMENTS`

If there is no argument, ask: "What is the flow name? (e.g., 'Inventory', 'SalesReturn')"

---

## What is a Flow in Etendo Headless

The data structure is:

```
etapi_openapi_flow      → tag/endpoint group (e.g., "SalesOrderFlow")
  etapi_openapi_flowpoint → links the flow to an endpoint + HTTP flags
    etapi_openapi_req   → endpoint (name = URL segment, type = ETRX_Tab)
      etrx_openapi_tab  → links to the ERP's ad_tab
        etrx_openapi_field → exposed fields with name and description
```

Access URL: `/etendo/sws/com.etendoerp.etendorx.datasource/{req.name}`
Auto-generated docs: `GET /etendo/ws/com.etendoerp.openapi.openAPIController?tag={flow.name}`

---

## Step 1 — Identify the ERP Tab

We need to know which `ad_tab` from the ERP we want to expose. Search by name:

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "SELECT t.ad_tab_id, t.name, tb.tablename
   FROM ad_tab t JOIN ad_table tb ON t.ad_table_id = tb.ad_table_id
   WHERE lower(t.name) LIKE lower('%$ARGUMENTS%')
   ORDER BY t.name LIMIT 20;"
```

Show the results to the user and ask them to confirm which `ad_tab_id` to use.
If the user already knows the tab ID, continue directly.

---

## Step 2 — Identify available fields

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "SELECT f.ad_field_id, f.name, c.columnname, c.ad_reference_id
   FROM ad_field f
   JOIN ad_column c ON f.ad_column_id = c.ad_column_id
   WHERE f.ad_tab_id = '<TAB_ID>'
   ORDER BY f.seqno LIMIT 50;"
```

Ask the user which fields they want to expose, or suggest the most common ones (organization, client, name, dates, status).

---

## Step 3 — Check if an etrx_openapi_tab already exists

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "SELECT * FROM etrx_openapi_tab WHERE ad_tab_id = '<TAB_ID>';"
```

If it already exists, use that `etrx_openapi_tab_id`. If not, create it in Step 4.

---

## Step 4 — Create the etrx_openapi_tab (if it doesn't exist)

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etrx_openapi_tab (
     etrx_openapi_tab_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     ad_tab_id, name
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<TAB_ID>', '<TAB_NAME>'
   );"
```

---

## Step 5 — Expose fields (etrx_openapi_field)

For each field the user wants to expose:

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etrx_openapi_field (
     etrx_openapi_field_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     etrx_openapi_tab_id, ad_field_id, name, description
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<ETRX_OPENAPI_TAB_ID>', '<AD_FIELD_ID>',
     '<api_name>', '<description>'
   );"
```

Repeat for each field. The minimum recommended fields are:
- `id` — internal identifier
- `organization` — organization
- `documentNo` / `name` — visible identifier
- Relevant status fields

---

## Step 6 — Create the endpoint (etapi_openapi_req)

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etapi_openapi_req (
     etapi_openapi_req_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     name, type, etrx_openapi_tab_id
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<EndpointName>', 'ETRX_Tab', '<ETRX_OPENAPI_TAB_ID>'
   );"
```

`name` is the URL segment: `/etendo/sws/com.etendoerp.etendorx.datasource/<EndpointName>`

---

## Step 7 — Create the Flow

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etapi_openapi_flow (
     etapi_openapi_flow_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     name, description
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<FlowName>', '<Flow description>'
   );"
```

---

## Step 8 — Link endpoint to the Flow (etapi_openapi_flowpoint)

```bash
docker exec -i etendo_setup-db-1 psql -U tad -d etendo -c \
  "INSERT INTO etapi_openapi_flowpoint (
     etapi_openapi_flowpoint_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     etapi_openapi_flow_id, etapi_openapi_req_id,
     isget, ispost, isput, isgetbyid
   ) VALUES (
     get_uuid(), '0', '0', 'Y',
     NOW(), '100', NOW(), '100',
     '<FLOW_ID>', '<REQ_ID>',
     'Y', 'Y', 'Y', 'Y'
   );"
```

Adjust the HTTP flags based on what the flow needs:
- `isget` → `GET /endpoint` (list)
- `isgetbyid` → `GET /endpoint/{id}` (get by ID)
- `ispost` → `POST /endpoint` (create)
- `isput` → `PUT /endpoint/{id}` (update)

---

## Step 9 — Verify

1. Get JWT:
```bash
curl -s -X POST http://localhost:8080/etendo/sws/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin","role":"42D0EEB1C66F497A90DD526DC597E6F0"}' \
  | jq -r '.token'
```

2. Verify generated docs:
```bash
curl -s "http://localhost:8080/etendo/ws/com.etendoerp.openapi.openAPIController?tag=<FlowName>" \
  -H "Authorization: Bearer <TOKEN>" | jq '.paths | keys'
```

3. Test GET:
```bash
curl -s "http://localhost:8080/etendo/sws/com.etendoerp.etendorx.datasource/<EndpointName>" \
  -H "Authorization: Bearer <TOKEN>" | jq '.response.data[0]'
```

---

## Common troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `404` on endpoint | `name` in `etapi_openapi_req` doesn't match the URL | Verify name accuracy |
| `AccessTableNoView` | Role `0` (System Admin) doesn't have access to business data | Use a business role in the JWT |
| `ActionNotAllowed` on PUT | The tab doesn't support update via headless | Check tab configuration in ERP |
| Missing fields in response | Field not added in `etrx_openapi_field` | Add the missing field |
| POST returns 200 but doesn't persist | Silent rollback due to callout error | Check Tomcat logs: `docker logs etendo-tomcat-1 \| grep ERROR` |
| `LazyInitializationException` on first request | ADCS bug on server (already fixed in this repo) | Recompile with `./gradlew smartbuild` |

---

## Reference IDs (F&B Spain - Demo)

```
CLIENT:   23C59575B9CF467C9620760EB255B389
ORG:      E443A31992CB4635AFCAEABE7183CE85
ROLE:     42D0EEB1C66F497A90DD526DC597E6F0
CREATEDBY (admin): 100
```

---

## Summary of involved tables

```sql
-- View all configured flows
SELECT f.name as flow, r.name as endpoint, r.type,
       fp.isget, fp.ispost, fp.isput, fp.isgetbyid
FROM etapi_openapi_flow f
JOIN etapi_openapi_flowpoint fp ON f.etapi_openapi_flow_id = fp.etapi_openapi_flow_id
JOIN etapi_openapi_req r ON fp.etapi_openapi_req_id = r.etapi_openapi_req_id
ORDER BY f.name, r.name;
```
