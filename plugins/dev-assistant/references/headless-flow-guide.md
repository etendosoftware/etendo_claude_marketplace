# Etendo Headless — How to create a complete Flow

**Source:** Reverse engineering of the `etendo` DB (Docker) + auto-generated OpenAPI docs

---

## Data Model (creation order matters)

```
etapi_openapi_flow          → Tag/group name for the OpenAPI docs
  etapi_openapi_flowpoint   → Links flow ↔ req + HTTP method flags
    etapi_openapi_req       → Endpoint definition (name = URL segment, type = ETRX_Tab | SMFWHE_WBHK)
      etrx_openapi_tab      → Links req ↔ ad_tab (1:1, FK lives here)
        etrx_openapi_field  → Each field to expose from the tab
```

**Endpoint URL:**
```
CRUD:    /etendo/sws/com.etendoerp.etendorx.datasource/{req.name}
Webhook: /etendo/sws/com.etendoerp.etendorx.datasource/{req.name}?param1=val1
Docs:    /etendo/ws/com.etendoerp.openapi.openAPIController?tag={flow.name}
```

---

## Creation Order

1. **`etapi_openapi_req`** first — the endpoint. `name` becomes the URL segment. `type` is NOT NULL.
2. **`etrx_openapi_tab`** — links the req to an `ad_tab`. The FK `etapi_openapi_req_id` is on this table (unique constraint).
3. **`etrx_openapi_field`** — one per exposed field. References `etrx_openapi_tab_id` + `ad_field_id`. No `name` column — the API name comes from the `ad_field`.
4. **`etapi_openapi_flow`** — the grouping tag.
5. **`etapi_openapi_flowpoint`** — links flow to each req with HTTP flags.

---

## Schema Gotchas

| Expected (from old docs) | Actual (in DB) |
|---|---|
| `etrx_openapi_tab.name` | **Does NOT exist** |
| `etrx_openapi_field.name` | **Does NOT exist** — name comes from `ad_field` |
| `etapi_openapi_req.etrx_openapi_tab_id` | **Reversed** — FK is on `etrx_openapi_tab.etapi_openapi_req_id` |
| `isget`, `ispost`, `isput`, `isgetbyid` | Actual columns: **`get`**, **`post`**, **`put`**, **`getbyid`** |
| `createdby/updatedby = '100'` | Use **`'0'`** for system-level records |

---

## Key Tables and Fields

### `etapi_openapi_req` — Endpoint Definition

| Field | Type | Required | Description |
|---|---|---|---|
| `etapi_openapi_req_id` | varchar(32) | PK | UUID via `get_uuid()` |
| `name` | varchar(255) | | URL segment: `/sws/.../datasource/{name}` |
| `type` | varchar(60) | **NOT NULL** | `ETRX_Tab` / `SMFWHE_WBHK` / `DEF` |
| `description` | text | | General description for docs + AI agents |
| `get_description` | text | | Description for GET (list) operation |
| `getbyid_description` | text | | Description for GET /{id} operation |
| `post_description` | text | | Description for POST (create) — include examples |
| `put_description` | text | | Description for PUT (update) operation |
| `ad_module_id` | varchar(32) | | **Required for export** |

### `etrx_openapi_tab` — ERP Tab linked to Endpoint

| Field | Type | Description |
|---|---|---|
| `etrx_openapi_tab_id` | varchar(32) | PK |
| `etapi_openapi_req_id` | varchar(32) | FK → endpoint (**UNIQUE**, FK lives here, not on req) |
| `ad_tab_id` | varchar(32) | FK → ad_tab (ERP tab) |
| `ad_module_id` | varchar(32) | **Required for export** |

### `etrx_openapi_field` — Exposed fields

| Field | Type | Description |
|---|---|---|
| `etrx_openapi_field_id` | varchar(32) | PK |
| `etrx_openapi_tab_id` | varchar(32) | FK → etrx_openapi_tab |
| `ad_field_id` | varchar(32) | FK → ad_field (**no `name` column** — API name comes from ad_field) |
| `description` | text | Hint for AI / doc of the field |
| `seqno` | numeric | Order in the documentation |
| `ad_module_id` | varchar(32) | **Required for export** |

### `etapi_openapi_flow` — the Flow (tag)

| Field | Type | Description |
|---|---|---|
| `etapi_openapi_flow_id` | varchar(32) | PK |
| `name` | varchar(255) | Flow name = tag in OpenAPI docs |
| `description` | text | Flow description |
| `open_swagger` | char(1) | `Y`/`N` — exposed in public Swagger |
| `ad_module_id` | varchar(32) | **Required for export** |

### `etapi_openapi_flowpoint` — Endpoint in the Flow

| Field | Type | Description |
|---|---|---|
| `etapi_openapi_flowpoint_id` | varchar(32) | PK |
| `etapi_openapi_flow_id` | varchar(32) | FK → flow |
| `etapi_openapi_req_id` | varchar(32) | FK → endpoint |
| `get` | char(1) | `Y`/`N` — enables GET (list) |
| `post` | char(1) | `Y`/`N` — enables POST (create) |
| `put` | char(1) | `Y`/`N` — enables PUT (update) |
| `getbyid` | char(1) | `Y`/`N` — enables GET /{id} |
| `ad_module_id` | varchar(32) | **Required for export** |

---

## Req Types

| `type` value | Meaning | Linked via |
|---|---|---|
| `ETRX_Tab` | CRUD endpoint backed by an AD tab | `etrx_openapi_tab` |
| `SMFWHE_WBHK` | Webhook endpoint (custom Java logic) | `smfwhe_openapi_webhk` |
| `DEF` | Custom servlet | `classname` field on req |

### Webhook Endpoints (type = SMFWHE_WBHK)

Require **3 records** instead of `etrx_openapi_tab`:

1. `smfwhe_definedwebhook` — Java class + name
2. `smfwhe_definedwebhook_param` — parameters (with `isrequired` flag)
3. `smfwhe_openapi_webhk` — links webhook ↔ req (unique on `etapi_openapi_req_id`)

Plus `smfwhe_definedwebhook_role` for role-based access.

**All 4 tables need `ad_module_id` set for export.**

---

## Required Columns (all tables)

Every record needs: `ad_client_id='0'`, `ad_org_id='0'`, `isactive='Y'`, `created/updated=NOW()`, `createdby/updatedby='0'`, **`ad_module_id`**.

If `ad_module_id` is NULL, `export.database` will silently skip the record.

---

## IDs

Always use `get_uuid()` — **never** `gen_random_uuid()`.

---

## Tab Selection

When the same table backs multiple windows (e.g., `C_Order` is used by both "Sales Order" and "Sales Quotation"), use the **specific window's tab**, not just any tab for that table. The `ad_tab_id` determines which window's callouts and defaults apply.

```sql
-- Find tabs for a table across different windows:
SELECT t.ad_tab_id, t.name, w.name as window_name, tbl.tablename
FROM ad_tab t
JOIN ad_table tbl ON t.ad_table_id = tbl.ad_table_id
JOIN ad_window w ON t.ad_window_id = w.ad_window_id
WHERE tbl.tablename = 'C_Order'
ORDER BY w.name, t.seqno;
```

---

## Field Selection Guidelines

Only expose fields that:
- **Are required for creation** (e.g., `businessPartner`, `product`)
- **Are user-provided** — not auto-completed by callouts (skip `priceList`, `paymentTerms`, `warehouse`, `partnerAddress`, `currency`, `UOM`, `tax`)
- **Are not calculated** (skip `lineNetAmount`, `grandTotal`, `docStatus`)
- **The user might want to override** (e.g., `netUnitPrice` which auto-fills from price list but can be overridden)

Always include `SimSearch` in the flow so agents can search by name instead of IDs.

---

## Resolving `ad_field_id` for fields

```sql
SELECT f.ad_field_id, f.name, c.columnname, c.ad_reference_id
FROM ad_field f
JOIN ad_column c ON c.ad_column_id = f.ad_column_id
WHERE f.ad_tab_id = '<TAB_ID>'
  AND f.isactive = 'Y'
ORDER BY f.seqno;
```

---

## SQL to create a complete Flow from scratch

```sql
DO $$
DECLARE
  v_module_id  TEXT := '<AD_MODULE_ID>';
  v_flow_id    TEXT := get_uuid();
  v_req_id     TEXT := get_uuid();
  v_oapi_tab   TEXT := get_uuid();
BEGIN

  -- 1. Endpoint (req)
  INSERT INTO etapi_openapi_req (
    etapi_openapi_req_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    name, type, ad_module_id,
    description, post_description, put_description
  ) VALUES (
    v_req_id, '0', '0', 'Y', NOW(), '0', NOW(), '0',
    'MyEntity', 'ETRX_Tab', v_module_id,
    'Creates or modifies a MyEntity record.',
    'Creates a MyEntity. Required: businessPartner.',
    'Modifies an existing MyEntity. Only send fields to update.'
  );

  -- 2. Tab mapping (FK lives here, not on req)
  INSERT INTO etrx_openapi_tab (
    etrx_openapi_tab_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    ad_tab_id, etapi_openapi_req_id, ad_module_id
  ) VALUES (
    v_oapi_tab, '0', '0', 'Y', NOW(), '0', NOW(), '0',
    '<AD_TAB_ID>', v_req_id, v_module_id
  );

  -- 3. Fields (no 'name' column — API name comes from ad_field)
  INSERT INTO etrx_openapi_field (
    etrx_openapi_field_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    etrx_openapi_tab_id, ad_field_id, ad_module_id,
    description, seqno
  ) VALUES
    (get_uuid(), '0', '0', 'Y', NOW(), '0', NOW(), '0',
     v_oapi_tab, '<FIELD_ID_1>', v_module_id,
     'ID of the Business Partner. Required.', 10),
    (get_uuid(), '0', '0', 'Y', NOW(), '0', NOW(), '0',
     v_oapi_tab, '<FIELD_ID_2>', v_module_id,
     'ID of the Organization.', 20);

  -- 4. Flow
  INSERT INTO etapi_openapi_flow (
    etapi_openapi_flow_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    name, description, ad_module_id
  ) VALUES (
    v_flow_id, '0', '0', 'Y', NOW(), '0', NOW(), '0',
    'MyEntityFlow', 'CRUD for MyEntity.', v_module_id
  );

  -- 5. Flowpoint (columns are 'get', 'post', 'put', 'getbyid' — NOT 'isget')
  INSERT INTO etapi_openapi_flowpoint (
    etapi_openapi_flowpoint_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    etapi_openapi_flow_id, etapi_openapi_req_id, ad_module_id,
    get, post, put, getbyid
  ) VALUES (
    get_uuid(), '0', '0', 'Y', NOW(), '0', NOW(), '0',
    v_flow_id, v_req_id, v_module_id,
    'N', 'Y', 'Y', 'N'
  );

END $$;
```

---

## Adding a Webhook endpoint to a flow

Webhooks use `type = 'SMFWHE_WBHK'` and require linking through `smfwhe_openapi_webhk`:

```sql
DO $$
DECLARE
  v_module_id   TEXT := '<AD_MODULE_ID>';
  v_flow_id     TEXT; -- existing flow
  v_webhook_id  TEXT := get_uuid();
  v_wh_req_id   TEXT := get_uuid();
BEGIN
  SELECT etapi_openapi_flow_id INTO v_flow_id
    FROM etapi_openapi_flow WHERE name = '<FlowName>';

  -- 1. Webhook definition
  INSERT INTO smfwhe_definedwebhook (
    smfwhe_definedwebhook_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    name, java_class, ad_module_id
  ) VALUES (
    v_webhook_id, '0', '0', 'Y', NOW(), '0', NOW(), '0',
    'MyWebhook', 'com.example.webhooks.MyWebhook', v_module_id
  );

  -- 2. Webhook parameters
  INSERT INTO smfwhe_definedwebhook_param (
    smfwhe_definedwebhook_param_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    smfwhe_definedwebhook_id, name, isrequired, ad_module_id
  ) VALUES (
    get_uuid(), '0', '0', 'Y', NOW(), '0', NOW(), '0',
    v_webhook_id, 'record_id', 'Y', v_module_id
  );

  -- 3. Webhook role access
  INSERT INTO smfwhe_definedwebhook_role (
    smfwhe_definedwebhook_role_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    smfwhe_definedwebhook_id, ad_role_id, ad_module_id
  ) VALUES (
    get_uuid(), '0', '0', 'Y', NOW(), '0', NOW(), '0',
    v_webhook_id, '0', v_module_id  -- System Administrator
  );

  -- 4. OpenAPI req (type = SMFWHE_WBHK)
  INSERT INTO etapi_openapi_req (
    etapi_openapi_req_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    name, type, ad_module_id,
    description, post_description
  ) VALUES (
    v_wh_req_id, '0', '0', 'Y', NOW(), '0', NOW(), '0',
    'MyWebhook', 'SMFWHE_WBHK', v_module_id,
    'Executes MyWebhook process.',
    'Requires record_id parameter.'
  );

  -- 5. Link webhook ↔ req
  INSERT INTO smfwhe_openapi_webhk (
    smfwhe_openapi_webhk_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    smfwhe_definedwebhook_id, etapi_openapi_req_id, ad_module_id
  ) VALUES (
    get_uuid(), '0', '0', 'Y', NOW(), '0', NOW(), '0',
    v_webhook_id, v_wh_req_id, v_module_id
  );

  -- 6. Flowpoint
  INSERT INTO etapi_openapi_flowpoint (
    etapi_openapi_flowpoint_id, ad_client_id, ad_org_id, isactive,
    created, createdby, updated, updatedby,
    etapi_openapi_flow_id, etapi_openapi_req_id, ad_module_id,
    get, post, put, getbyid
  ) VALUES (
    get_uuid(), '0', '0', 'Y', NOW(), '0', NOW(), '0',
    v_flow_id, v_wh_req_id, v_module_id,
    'N', 'Y', 'N', 'N'
  );
END $$;
```

---

## Descriptions

`etapi_openapi_req` supports per-method descriptions that feed directly into the auto-generated OpenAPI/Swagger docs:
- `description` — general endpoint description
- `get_description` — for GET (list)
- `getbyid_description` — for GET /{id}
- `post_description` — for POST (create) — **include JSON examples**
- `put_description` — for PUT (update)

---

## How to view the auto-generated docs

```bash
# By flow (tag):
curl -s 'http://localhost:8080/etendo/ws/com.etendoerp.openapi.openAPIController?tag=MyFlow' \
  -H 'Authorization: Basic YWRtaW46YWRtaW4=' | python3 -m json.tool

# All flows:
curl -s 'http://localhost:8080/etendo/ws/com.etendoerp.openapi.openAPIController' \
  -H 'Authorization: Basic YWRtaW46YWRtaW4='
```

The `/ws/` URL requires Basic Auth (admin).
The `/sws/` URL requires JWT Bearer token.

---

## Common troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `404` on endpoint | `name` in `etapi_openapi_req` doesn't match URL | Verify name spelling |
| Record not exported | `ad_module_id` is NULL | Set it on ALL records |
| `type` NOT NULL violation | Missing `type` on `etapi_openapi_req` INSERT | Add `type = 'ETRX_Tab'` or `'SMFWHE_WBHK'` |
| `AccessTableNoView` | Role `0` (System Admin) doesn't have access to business data | Use a business role in the JWT |
| `ActionNotAllowed` on PUT | Tab doesn't support update via headless | Check tab configuration in ERP |
| Missing fields in response | Field not added in `etrx_openapi_field` | Add the missing field |
| POST returns 200 but doesn't persist | Silent rollback due to callout error | Check Tomcat logs |
| Webhook not in flow | Missing `etapi_openapi_req` + `smfwhe_openapi_webhk` link | Create req (type=SMFWHE_WBHK) + link record |

---

## Reference of existing flows

| Flow | Main Endpoints |
|---|---|
| BusinessPartner | BusinessPartner, BPCustomer, BPVendor, BPAddress, BPCategory |
| Sales Order Flow | SalesOrder, SalesOrderLines, SimSearch |
| Sales Quotation Flow | SalesQuotation, SalesQuotationLines, SimSearch, OrderProcess |
| Sales Invoice Flow | SalesInvoice, SalesInvoiceLine, BPAddress, TaxRate |
| Purchase Order Flow | PurchaseOrder, PurchaseOrderLines |
| Purchase Invoice Flow | PurchaseInvoice, PurchaseInvoiceLine |
| Product | Product, ProductCategory, ProductPrice |
| Inventory | Inventory, InventoryLines |

---

## Summary query

```sql
-- View all configured flows
SELECT f.name as flow, r.name as endpoint, r.type,
       fp.get, fp.post, fp.put, fp.getbyid
FROM etapi_openapi_flow f
JOIN etapi_openapi_flowpoint fp ON f.etapi_openapi_flow_id = fp.etapi_openapi_flow_id
JOIN etapi_openapi_req r ON fp.etapi_openapi_req_id = r.etapi_openapi_req_id
ORDER BY f.name, r.name;
```
