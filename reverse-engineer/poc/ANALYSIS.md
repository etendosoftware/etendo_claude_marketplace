# POC Analysis — sales_order (create + complete)

**Session:** `sales_order_all.session.json`
**Total calls captured:** 27
**Essential calls:** 3
**Noise (UI only):** 24

---

## Call Map

| Seq | Entity / Action | Op | Essential | Why |
|---|---|---|---|---|
| 01 | FormInitializationComponent TAB=186 NEW | — | no | Renders empty form |
| 02 | F8DD408F2F3A... | fetch | no | Combo refresh |
| 03 | FormInitializationComponent TAB=186 CHANGE | — | no | Field change reaction |
| 04 | AlertActionHandler | — | no | Notification check |
| **05** | **Order** | **add** | **YES** | **Creates order header** |
| 06 | StorePropertyActionHandler | — | no | Saves UI state |
| 07 | F8DD408F2F3A... | fetch | no | Combo refresh |
| 08 | OrderLine | fetch | no | Re-read (empty) |
| 09 | FormInitializationComponent TAB=186 SETSESSION | — | no | Session state |
| 10 | F8DD408F2F3A... | fetch | no | Combo refresh |
| 11 | FormInitializationComponent TAB=187 NEW | — | no | Opens order line tab |
| 12 | ProductByPriceAndWarehouse | fetch | no | Loads product picker |
| 13 | FormInitializationComponent TAB=187 CHANGE | — | no | Product selected |
| 14 | FormInitializationComponent TAB=187 CHANGE | — | no | Quantity changed |
| **15** | **OrderLine** | **add** | **YES** | **Creates order line** |
| 16 | ProductByPriceAndWarehouse | fetch | no | Refreshes product list |
| 17 | StorePropertyActionHandler | — | no | UI state |
| 18 | Order | fetch | no | Re-read (still DR) |
| 19 | FormInitializationComponent TAB=187 SETSESSION | — | no | Session state |
| 20 | FormInitializationComponent TAB=186 EDIT | — | no | Re-opens header tab |
| 21 | ProductByPriceAndWarehouse | fetch | no | UI refresh |
| 22 | StorePropertyActionHandler | — | no | UI state |
| **23** | **FormInitializationComponent TAB=186 EDIT** | **inpdocaction=CO** | **YES** | **Completes the order** |
| 24 | Order | fetch | no | Re-read (now CO) |
| 25 | FormInitializationComponent TAB=186 EDIT | — | no | Refreshes completed form |
| 26 | GetTabMessageActionHandler | — | no | Validation messages |
| 27 | OrderLine | fetch | no | Re-read lines |

**Confirmed via Order reads:**
- Call [18]: `documentStatus=DR` (draft, before complete)
- Call [24]: `documentStatus=CO` (complete, after call [23])

---

## The 3 Essential Calls

### 1. Create Order Header
```
POST /etendo/org.openbravo.service.datasource/Order

{
  "dataSource": "Order",
  "operationType": "add",
  "data": {
    "organization":          "{{orgId}}",
    "client":                "{{clientId}}",
    "transactionDocument":   "{{salesOrderDocTypeId}}",
    "orderDate":             "{{today}}",
    "scheduledDeliveryDate": "{{today}}",
    "accountingDate":        "{{today}}",
    "businessPartner":       "{{customerId}}",
    "partnerAddress":        "{{customerAddressId}}",     // from customer
    "invoiceAddress":        "{{customerAddressId}}",     // same
    "priceList":             "{{priceListId}}",           // from customer
    "paymentTerms":          "{{paymentTermsId}}",        // from customer
    "paymentMethod":         "{{paymentMethodId}}",       // from customer
    "currency":              "{{currencyId}}",            // from price list
    "warehouse":             "{{warehouseId}}",           // from setup
    "userContact":           "{{currentUserId}}",
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
    "ORDERTYPE":             "SO",
    "DOCBASETYPE":           "SOO"
  }
}

→ capture: orderId = response.response.data[0].id
→ capture: documentNo = response.response.data[0].documentNo
```

### 2. Create Order Line (repeat per line)
```
POST /etendo/org.openbravo.service.datasource/OrderLine

{
  "dataSource": "OrderLine",
  "operationType": "add",
  "data": {
    "salesOrder":            "{{orderId}}",             // from step 1
    "lineNo":                "{{10 * lineIndex}}",      // 10, 20, 30...
    "organization":          "{{orgId}}",
    "client":                "{{clientId}}",
    "currency":              "{{currencyId}}",
    "warehouse":             "{{warehouseId}}",
    "businessPartner":       "{{customerId}}",
    "partnerAddress":        "{{customerAddressId}}",
    "orderDate":             "{{today}}",
    "scheduledDeliveryDate": "{{today}}",
    "product":               "{{productId}}",
    "orderedQuantity":       "{{quantity}}",
    "operativeQuantity":     "{{quantity}}",
    "uOM":                   "{{productUomId}}",        // from product
    "operativeUOM":          "{{productUomId}}",
    "unitPrice":             "{{price}}",               // from ProductByPriceAndWarehouse
    "listPrice":             "{{price}}",
    "standardPrice":         "{{price}}",
    "lineNetAmount":         "{{quantity * price}}",
    "taxableAmount":         "{{quantity * price}}",
    "tax":                   "{{productTaxId}}",        // from product
    "DOCBASETYPE":           "SOO"
  }
}

→ capture: orderLineId = response.response.data[0].id
```

### 3. Complete Order
```
POST /etendo/org.openbravo.client.kernel
     ?MODE=EDIT
     &TAB_ID=186
     &PARENT_ID=null
     &ROW_ID={{orderId}}
     &_action=org.openbravo.client.application.window.FormInitializationComponent

{
  "inpcOrderId":          "{{orderId}}",
  "C_Order_ID":           "{{orderId}}",
  "inpadOrgId":           "{{orgId}}",
  "inpadClientId":        "{{clientId}}",
  "inpcDoctypetargetId":  "{{salesOrderDocTypeId}}",
  "inpcDoctypeId":        "{{salesOrderDocTypeId}}",
  "inpdocumentno":        "{{documentNo}}",
  "inpdateordered":       "{{today}}",
  "inpdatepromised":      "{{today}}",
  "inpdateacct":          "{{today}}",
  "inpcBpartnerId":       "{{customerId}}",
  "inpcBpartnerLocationId": "{{customerAddressId}}",
  "inpmPricelistId":      "{{priceListId}}",
  "inpcPaymenttermId":    "{{paymentTermsId}}",
  "inpfinPaymentmethodId":"{{paymentMethodId}}",
  "inpmWarehouseId":      "{{warehouseId}}",
  "inpcCurrencyId":       "{{currencyId}}",
  "inpgrandtotal":        "{{grandTotal}}",
  "inptotallines":        "{{totalLines}}",
  "inpdocaction":         "CO",
  "inpdocstatus":         "DR",
  "inpissotrx":           "Y",
  "inpprocessed":         "N",
  "inpposted":            "N",
  "inpTabId":             "186",
  "inpwindowId":          "143",
  "inpTableId":           "259",
  "inpkeyColumnId":       "C_Order_ID",
  "keyProperty":          "id",
  "ORDERTYPE":            "SO",
  "DOCBASETYPE":          "SOO"
}

→ verify: GET datasource/Order?id={{orderId}} → documentStatus == "CO"
```

---

## Key Findings

### Finding 1: Complete is NOT a datasource update
The "Complete" action uses `FormInitializationComponent` MODE=EDIT with `inpdocaction=CO`,
not a `datasource/Order` with `operationType=update`.
The full order field state must be re-submitted as `inp*` fields.

### Finding 2: Lookup needed before creating
Two lookups are required before building the payloads:

**Customer lookup** → `GET datasource/BusinessPartner?id={customerId}`
Resolves: `partnerAddress`, `priceList`, `paymentTerms`, `paymentMethod`, `currency`

**Product price lookup** → `GET datasource/ProductByPriceAndWarehouse` (per line)
Resolves: `unitPrice`, `uOM`, `tax`

### Finding 3: Field name mapping (datasource vs inp*)
Etendo uses two naming conventions for the same fields:
- **Datasource (JSON):** `businessPartner`, `priceList`, `orderDate`
- **FormInit (inp* form):** `inpcBpartnerId`, `inpmPricelistId`, `inpdateordered`

The Orchestration Layer must maintain a mapping table for the complete call.

### Finding 4: TAB_ID and window constants
These are fixed per operation type (not dynamic):
```
Sales Order window:   windowId=143, tabId=186, tableId=259
Sales Order Line tab: tabId=187
```

---

## Orchestration Layer — Simplified API

**Input from Etendo Lite UI:**
```json
POST /lite/sales/orders
{
  "customerId": "A6750F0D15334FB890C254369AC750A8",
  "lines": [
    { "productId": "C11ECF6EF3BC4240B374DD5A76163A85", "quantity": 12 }
  ]
}
```

**Internal sequence (4 steps + N line lookups):**
```
1. GET BusinessPartner          → resolve customer fields
2. GET ProductByPriceAndWarehouse × N → resolve prices per product
3. POST datasource/Order (add)  → create header → orderId
4. POST datasource/OrderLine × N → create lines
5. POST kernel FormInit EDIT    → complete (inpdocaction=CO)
6. GET datasource/Order         → verify documentStatus=CO
```

**Response to UI:**
```json
{
  "orderId": "9A489EF1E83640BC9B7000F1406F0C1C",
  "documentNo": "1000365",
  "documentStatus": "CO",
  "grandTotal": 21.63
}
```

---

---

## Finding 5: Product Search

**Datasource:** `ProductByPriceAndWarehouse` (special selector datasource with price context)

```
POST /etendo/org.openbravo.service.datasource/ProductByPriceAndWarehouse
Content-Type: application/x-www-form-urlencoded

_selectorDefinitionId=2E64F551C7C4470C80C29DBA24B34A5F
&filterClass=org.openbravo.userinterface.selector.SelectorDataSourceFilter
&_operationType=fetch
&_sortBy=_identifier
&_textMatchStyle=substring
&_endRow=75
&_noCount=true
&_extraProperties=product$id,productPrice$priceListVersion$priceList$currency$id,product$uOM$id,standardPrice,netListPrice,priceLimit
&targetProperty=product
&columnName=M_Product_ID
&IsSelectorItem=true
&_constructor=AdvancedCriteria
&operator=or
&criteria={"fieldName":"_identifier","operator":"iContains","value":"{{searchText}}","_constructor":"AdvancedCriteria"}

// Context (from order/setup):
&inpmPricelistId={{priceListId}}
&inpmWarehouseId={{warehouseId}}
&inpadOrgId={{orgId}}
&inpadClientId={{clientId}}
&windowId=143
&tabId=187
&adTabId=187
```

**Response fields mapping:**

| Response field | Used as |
|---|---|
| `_identifier` | Display name shown to user |
| `product$id` | `productId` → passed to OrderLine |
| `product$uOM$id` | `uomId` → passed to OrderLine |
| `standardPrice` | `unitPrice` → passed to OrderLine |
| `netListPrice` | `listPrice` → passed to OrderLine |
| `priceLimit` | `priceLimit` → passed to OrderLine |

**Critical:** price list and warehouse must be in the request context.
Without them Etendo returns prices from the wrong list or no results.

**For Etendo Lite UI:** search box sends `searchText` → Orchestration Layer injects
`priceListId` and `warehouseId` from the tenant setup config.

---

## Finding 6: Customer Search — NOT in this session

The customer was pre-selected before the recording started.
Not captured. Needs a separate recording.

**What we know from the datasource pattern:**
- It will use `BusinessPartner` datasource (or a BP-specific selector)
- Will need a `_selectorDefinitionId` specific to BP selectors
- Will filter by `isCustomer='Y'` (or `isVendor='Y'` for vendors)
- Will return: name, address ID, priceList, paymentTerms, paymentMethod

**To record:**
```js
recorder.start("search_customer")
// In the sales order form, click on the Customer field and type a search term
recorder.stop()
```

---

## Orchestration Layer — Search Endpoints

```
// Product search (price-list aware)
GET /lite/masters/products/search?q={{text}}
  → internally: POST ProductByPriceAndWarehouse with priceListId + warehouseId from setup
  → returns: [{ id, name, unitPrice, uomId, taxId }]

// Customer search
GET /lite/masters/customers/search?q={{text}}
  → internally: POST BusinessPartner selector with isCustomer=Y filter
  → returns: [{ id, name, addressId, priceListId, paymentTermsId, paymentMethodId }]

// Vendor search (same pattern, isVendor=Y)
GET /lite/masters/vendors/search?q={{text}}
```

---

## Recordings Status

### Phase B — Operations

| Operation | File | Status | Notes |
|---|---|---|---|
| `create_sales_order` | `sales_order_all.session.json` | ✅ | 2 writes: Order + OrderLine (op=add) |
| `complete_sales_order` | `sales_order_all.session.json` | ✅ | FormInit EDIT TAB=186 inpdocaction=CO |
| `search_product` | `sales_order_all.session.json` | ✅ | ProductByPriceAndWarehouse selector (inferred) |
| `search_customer` | `search_customer.session.json` | ✅ | 3 calls, pure reads — pattern extracted |
| `create_sales_invoice` | `create_sales_invoice.session.json` | ✅ | Invoice op=add + InvoiceLine op=update _new=True |
| `complete_sales_invoice` | `create_sales_invoice.session.json` | ✅ | FormInit EDIT TAB=263 inpdocaction=CO |
| `create_purchase_order` | `create_order_invoice.session.json` | ✅ | Order op=add + OrderLine op=add |
| `complete_purchase_order` | `create_order_invoice.session.json` | ✅ | FormInit EDIT TAB=294 inpdocaction=CO |
| `create_purchase_invoice` | `create_purchase_invoice2.session.json` | ✅ | Invoice op=add + InvoiceLine op=update _new=True |
| `complete_purchase_invoice` | `complete_purchase_invoice2.session.json` | ⚠️ | inpdocaction=RE (Reactivate) — not CO. Re-record. |

### Phase A — Setup & Master Data (all missing)

| Operation | Status |
|---|---|
| `setup_organization` | ❌ |
| `setup_warehouse` | ❌ |
| `setup_document_types` | ❌ |
| `setup_taxes` | ❌ |
| `setup_sales_price_list` | ❌ |
| `setup_purchase_price_list` | ❌ |
| `setup_payment_terms` | ❌ |
| `setup_payment_methods` | ❌ |
| `setup_bp_category` | ❌ |
| `create_product` | ❌ |
| `create_customer` | ❌ |
| `create_vendor` | ❌ |

---

## Critical Findings From New Sessions

### InvoiceLine uses op=update with _new=True (not op=add)

Unlike `OrderLine` which uses `operationType=add`, invoice lines are created with:
```json
{ "operationType": "update", "data": { "_new": true, ... } }
```
The Orchestration Layer runner must handle this distinction.

### Sales vs Purchase document constants

| | Sales | Purchase |
|---|---|---|
| TAB_ID (header) | 263 (invoice) / 186 (order) | 290 (invoice) / 294 (order) |
| issotrx | Y | N (absent) |
| transactionDocument | 7FCD49652E104E6BB06C3A0D787412E3 | F2EB2EAD2612449A83C28DA84689D78B |
| DOCBASETYPE | ARI | API |

### complete_purchase_invoice recorded as RE not CO

`complete_purchase_invoice2.session.json` shows `inpdocaction=RE` (Reactivate — undoes a complete).
The actual complete should be `CO`. This session needs to be re-recorded correctly.
