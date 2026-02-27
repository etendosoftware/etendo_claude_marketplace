# Etendo API — Usage Guide from Orchestration Layer

**Etendo Version:** 26Q1
**Source:** Reverse engineering of session recordings + etendo_core analysis

---

## Available APIs

### 1. DataSource API (the one the browser uses)

```
Base: /etendo/org.openbravo.service.datasource/{EntityName}
```

- Requires authenticated session (JSESSIONID)
- **Requires CSRF token in the body** for POST/PUT/DELETE
- GET (fetch) does not require CSRF
- Wrapped payload: `{ dataSource, operationType, data, oldValues, csrfToken }`

### 2. JSON REST API (for programmatic integration)

```
Base: /etendo/org.openbravo.service.json.jsonrest/{EntityName}
```

- Accepts Basic Auth directly (stateless)
- **No CSRF** in any operation
- Simple payload: `{ "data": { ...fields... } }`
- Same response: `{ "response": { "status": 0, "data": [...] } }`

### 3. Kernel (FormInit, action handlers)

```
Base: /etendo/org.openbravo.client.kernel?_action=...
```

- Requires authenticated session (JSESSIONID)
- **No CSRF**
- Used for document actions (complete, void, etc.)

---

## Session flow (etendo.js)

```
establishSession(url, authorization):
  1. GET /etendo/
     → JSESSIONID (login + fillSessionArguments → #CSRF_Token in session)

  2. GET /etendo/org.openbravo.client.kernel/org.openbravo.client.kernel/ApplicationDynamic
     → extracts csrfToken from JS: /csrfToken\s*:\s*'([A-Z0-9]+)'/

Cache: Map<url::auth → { jsessionid, csrfToken }>
Invalidation: on InvalidCSRFToken or 401 error
```

---

## Endpoints used in Etendo Lite

### Customer search (BusinessPartner)

```
GET /etendo/org.openbravo.service.datasource/BusinessPartner
  ?_operationType=fetch
  &_startRow=0&_endRow=1
  &criteria=[{"fieldName":"id","operator":"equals","value":"..."}]
```

### Customer address search

```
GET /etendo/org.openbravo.service.datasource/BusinessPartnerLocation
  ?_operationType=fetch
  &criteria=[{"fieldName":"businessPartner","operator":"equals","value":"..."},
             {"fieldName":"invoiceToAddress","operator":"equals","value":true}]
```

### Product price by price list

```
GET /etendo/org.openbravo.service.datasource/ProductByPriceAndWarehouse
  ?_operationType=fetch
  &_selectorDefinitionId={{productSelectorId}}
  &targetProperty=product
  &columnName=M_Product_ID
  &inpmPricelistId={{priceListId}}
  &inpmWarehouseId={{warehouseId}}
  &criteria=[{"fieldName":"product","operator":"equals","value":"..."},
             {"fieldName":"warehouse","operator":"equals","value":"..."}]
```

### Create sales order

```
POST /etendo/org.openbravo.service.datasource/Order
  ?windowId=143&tabId=186&moduleId=0
  &_operationType=update&_noActiveFilter=true&sendOriginalIDBack=true
  &Constants_FIELDSEPARATOR=%24&_className=OBViewDataSource
  &Constants_IDENTIFIER=_identifier&isc_dataFormat=json

Body:
{
  "dataSource": "Order",
  "operationType": "add",
  "data": {
    "organization":          "{{orgId}}",
    "client":                "{{clientId}}",
    "transactionDocument":   "{{salesOrderDocTypeId}}",
    "orderDate":             "YYYY-MM-DD",
    "scheduledDeliveryDate": "YYYY-MM-DD",
    "accountingDate":        "YYYY-MM-DD",
    "businessPartner":       "{{customerId}}",
    "partnerAddress":        "{{partnerAddressId}}",
    "invoiceAddress":        "{{partnerAddressId}}",
    "priceList":             "{{priceListId}}",
    "paymentTerms":          "{{paymentTermsId}}",
    "paymentMethod":         "{{paymentMethodId}}",
    "currency":              "{{currencyId}}",
    "warehouse":             "{{warehouseId}}",
    "userContact":           "{{userContactId}}",
    "documentStatus":        "DR",
    "documentAction":        "CO",
    "salesTransaction":      true,
    "invoiceTerms":          "D",
    "deliveryMethod":        "P",
    "deliveryTerms":         "A",
    "freightCostRule":       "I",
    "priority":              "5",
    "formOfPayment":         "P",
    "posted":                "N",
    "active":                true,
    "ORDERTYPE":             "SO",
    "DOCBASETYPE":           "SOO"
  },
  "oldValues": {},
  "csrfToken": "{{csrfToken}}"    ← injected automatically by etendo.js
}
```

Response:
```json
{ "response": { "status": 0, "data": [{ "id": "...", "documentNo": "..." }] } }
```

### Create order line

```
POST /etendo/org.openbravo.service.datasource/OrderLine
  ?windowId=143&tabId=187&moduleId=0&_operationType=update&...

Body:
{
  "dataSource": "OrderLine",
  "operationType": "add",
  "data": {
    "salesOrder":            "{{orderId}}",
    "lineNo":                10,
    "organization":          "{{orgId}}",
    "client":                "{{clientId}}",
    "currency":              "{{currencyId}}",
    "warehouse":             "{{warehouseId}}",
    "businessPartner":       "{{customerId}}",
    "partnerAddress":        "{{partnerAddressId}}",
    "orderDate":             "YYYY-MM-DD",
    "scheduledDeliveryDate": "YYYY-MM-DD",
    "product":               "{{productId}}",
    "orderedQuantity":       1,
    "operativeQuantity":     1,
    "uOM":                   "{{uomId}}",
    "operativeUOM":          "{{uomId}}",
    "unitPrice":             1.49,
    "listPrice":             1.49,
    "standardPrice":         1.49,
    "lineNetAmount":         1.49,
    "taxableAmount":         1.49,
    "active":                true,
    "DOCBASETYPE":           "SOO"
  },
  "oldValues": {},
  "csrfToken": "{{csrfToken}}"
}
```

### Complete order (FormInit)

```
POST /etendo/org.openbravo.client.kernel
  ?MODE=EDIT&TAB_ID=186&PARENT_ID=null&ROW_ID={{orderId}}
  &_action=org.openbravo.client.application.window.FormInitializationComponent

Content-Type: application/x-www-form-urlencoded
Body: inpdocaction=CO&inpcOrderId={{orderId}}&inpdocstatus=DR&...
```

**Does not need csrfToken.**

---

## Date formats

| Context | Format |
|---|---|
| JSON Payload (data.*) | `YYYY-MM-DD` |
| FormInit payload (inp*) | `DD-MM-YYYY` |

---

## Window/tab IDs (Etendo 26Q1)

| Entity | windowId | tabId |
|---|---|---|
| Sales Order header | 143 | 186 |
| Sales Order lines | 143 | 187 |
| Sales Invoice header | 167 | 263 |
| Sales Invoice lines | 167 | 270 |
| Purchase Order header | 183 | 294 |
| Purchase Invoice header | 183 | 290 |

---

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `InvalidCSRFToken` | Missing or expired CSRF token | Re-establish session, include token |
| `AccessTableNoView` | No permissions for the entity | Check user role |
| `status: -1` | Business error (required field, etc.) | See `response.error.message` |
| 401 Unauthorized | Invalid credentials | Check Basic Auth |
| 403 Forbidden | No permission for the endpoint | Check user permissions |
