# Etendo Headless — How to create a complete Flow

**Source:** Reverse engineering of the `etendo` DB (Docker) + auto-generated OpenAPI docs

---

## System Architecture

```
etapi_openapi_flow          (Flow / OpenAPI tag)
    │ 1:N
    ├── etapi_openapi_flowpoint  (Endpoint in the flow + HTTP flags)
    │       │ N:1
    │       └── etapi_openapi_req    (Endpoint definition: name, type, description)
    │                   │ 1:1
    │                   └── etrx_openapi_tab     (Etendo Tab that resolves the endpoint)
    │                               │ 1:N
    │                               └── etrx_openapi_field   (Exposed fields + docs per field)
    │                                           │ N:1
    │                                           └── ad_field (Actual field of the tab in Etendo ERP)
```

**Endpoint URL:**
```
/sws/com.etendoerp.etendorx.datasource/{etapi_openapi_req.name}
```

**Auto-generated Docs:**
```
GET /etendo/ws/com.etendoerp.openapi.openAPIController?tag={flow_name}
```

---

## Key Tables and Fields

### `etapi_openapi_flow` — the Flow (tag)

| Field | Type | Description |
|---|---|---|
| `etapi_openapi_flow_id` | varchar(32) | PK (UUID without dashes) |
| `name` | varchar(255) | Flow name = tag in OpenAPI docs |
| `description` | text | Flow description (appears in the doc) |
| `open_swagger` | char(1) | `Y`/`N` — whether it is exposed in public Swagger |
| `ad_client_id` / `ad_org_id` | varchar(32) | `'0'` for system level |

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

### `etapi_openapi_req` — Endpoint Definition

| Field | Type | Description |
|---|---|---|
| `etapi_openapi_req_id` | varchar(32) | PK |
| `name` | varchar(255) | URL segment: `/sws/.../datasource/{name}` |
| `description` | text | Description for doc + AI agents |
| `type` | varchar(60) | `ETRX_Tab` (tab-backed) / `SMFWHE_WBHK` (webhook) / `DEF` (custom) |
| `classname` | varchar(200) | Only for `DEF` — null for `ETRX_Tab` |

### `etrx_openapi_tab` — ERP Tab associated with the Endpoint

| Field | Type | Description |
|---|---|---|
| `etrx_openapi_tab_id` | varchar(32) | PK |
| `etapi_openapi_req_id` | varchar(32) | FK → endpoint (UNIQUE) |
| `ad_tab_id` | varchar(32) | FK → ad_tab (ERP tabId) |

### `etrx_openapi_field` — Exposed fields with documentation

| Field | Type | Description |
|---|---|---|
| `etrx_openapi_field_id` | varchar(32) | PK |
| `etrx_openapi_tab_id` | varchar(32) | FK → etrx_openapi_tab |
| `ad_field_id` | varchar(32) | FK → ad_field (actual field of the tab) |
| `description` | text | Hint for AI / doc of the field |
| `seqno` | numeric | Order in the documentation |

---

## Endpoint types (`etapi_openapi_req.type`)

| Type | Use | classname |
|---|---|---|
| `ETRX_Tab` | Tab-backed CRUD (standard) | null |
| `SMFWHE_WBHK` | Webhook (SimSearch, LocationWebhook, etc.) | null |
| `DEF` | Custom servlet | classname required |

**Always use `ETRX_Tab`** for standard datasource endpoints.

---

## Resolving `ad_field_id` for fields

```sql
-- Search for fields of a specific tab
SELECT f.ad_field_id, f.name, c.columnname
FROM ad_field f
JOIN ad_column c ON c.ad_column_id = f.ad_column_id
WHERE f.ad_tab_id = '186'   -- tabId of the endpoint
ORDER BY f.seqno;
```

---

## SQL to create a complete Flow from scratch

```sql
DO $$
DECLARE
  flow_id    VARCHAR(32);
  req_id_1   VARCHAR(32);
  tab_id_1   VARCHAR(32);
  req_id_2   VARCHAR(32);
  tab_id_2   VARCHAR(32);
BEGIN

  -- ── 1. Flow ────────────────────────────────────────────────────────
  flow_id := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO etapi_openapi_flow
    (etapi_openapi_flow_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     name, description, open_swagger)
  VALUES (flow_id, '0', '0', 'Y', now(), '0', now(), '0',
    'MyFlow',
    'This API allows to manage X in Etendo ERP.',
    'N');

  -- ── 2. Endpoint A (header) ─────────────────────────────────────────
  req_id_1 := replace(gen_random_uuid()::text, '-', '');
  tab_id_1 := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO etapi_openapi_req
    (etapi_openapi_req_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     name, description, type)
  VALUES (req_id_1, '0', '0', 'Y', now(), '0', now(), '0',
    'MyEntity',
    'Creates/modifies a MyEntity record in the system.',
    'ETRX_Tab');

  INSERT INTO etrx_openapi_tab
    (etrx_openapi_tab_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     ad_tab_id, etapi_openapi_req_id)
  VALUES (tab_id_1, '0', '0', 'Y', now(), '0', now(), '0',
    '186',   -- ERP ad_tab_id
    req_id_1);

  -- Flowpoint: enable POST and PUT (typical for header)
  INSERT INTO etapi_openapi_flowpoint
    (etapi_openapi_flowpoint_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     etapi_openapi_flow_id, etapi_openapi_req_id,
     get, post, put, getbyid)
  VALUES (replace(gen_random_uuid()::text, '-', ''), '0', '0', 'Y', now(), '0', now(), '0',
    flow_id, req_id_1,
    'N', 'Y', 'Y', 'N');

  -- ── 3. Endpoint A fields with documentation ─────────────────────
  -- Search for ad_field_id with: SELECT ad_field_id, name FROM ad_field WHERE ad_tab_id='186'
  INSERT INTO etrx_openapi_field
    (etrx_openapi_field_id, ad_client_id, ad_org_id, isactive,
     created, createdby, updated, updatedby,
     etrx_openapi_tab_id, ad_field_id, ad_module_id, description, seqno)
  VALUES
    (replace(gen_random_uuid()::text, '-', ''), '0', '0', 'Y', now(), '0', now(), '0',
     tab_id_1, '1573',  -- businessPartner field
     '0',
     'ID of the Business Partner (customer or vendor).', 10),

    (replace(gen_random_uuid()::text, '-', ''), '0', '0', 'Y', now(), '0', now(), '0',
     tab_id_1, '2052',  -- organization field
     '0',
     'ID of the Organization. If not specified, auto-selected.', 20);

  -- ── 4. Endpoint B (lines) ──────────────────────────────────────────
  -- (repeat pattern for lines with ad_tab_id='187')

END $$;
```

---

## Endpoints currently used by Etendo Lite

| Flow | Endpoint | Tab | Table | GET | POST | PUT |
|---|---|---|---|---|---|---|
| BusinessPartner | `BPCustomer` | 223 | C_BPartner | ✓ | ✓ | ✓ |
| BusinessPartner | `BPAddress` | 222 | C_BPartner_Location | ✓ | ✓ | ✓ |
| Sales Order Flow | `SalesOrder` | 186 | C_Order | — | ✓ | ✓ |
| Sales Order Flow | `SalesOrderLines` | 187 | C_OrderLine | — | ✓ | ✓ |

---

## How to view the auto-generated docs

```bash
# By flow (tag):
curl -s 'http://localhost:8080/etendo/ws/com.etendoerp.openapi.openAPIController?tag=BusinessPartner' \
  -H 'Authorization: Basic YWRtaW46YWRtaW4=' | python3 -m json.tool

# All flows:
curl -s 'http://localhost:8080/etendo/ws/com.etendoerp.openapi.openAPIController' \
  -H 'Authorization: Basic YWRtaW46YWRtaW4='
```

The `/ws/` URL requires Basic Auth (admin).
The `/sws/` URL requires JWT Bearer token.

---

## Reference of existing flows

| Flow | Main Endpoints |
|---|---|
| BusinessPartner | BusinessPartner, BPCustomer, BPVendor, BPAddress, BPCategory |
| Sales Order Flow | SalesOrder, SalesOrderLines, SimSearch |
| Sales Invoice Flow | SalesInvoice, SalesInvoiceLine, BPAddress, TaxRate |
| Purchase Order Flow | PurchaseOrder, PurchaseOrderLines |
| Purchase Invoice Flow | PurchaseInvoice, PurchaseInvoiceLine |
| Product | Product, ProductCategory, ProductPrice |
| Inventory | Inventory, InventoryLines |
