# Etendo Lite — UI Flow Spec

**Based on:** confirmed recordings + data model analysis
**Date:** 2026-02-19

---

## What we know with certainty

From recordings, the **true user input** for every operation:

| Operation | User provides | Everything else |
|---|---|---|
| New Sale / Order | customer (search) + date | derived from customer + setup |
| New Purchase / Order | vendor (search) + date | derived from vendor + setup |
| Any line | product (search) + quantity | price, tax, uom → from product lookup |

This drives the entire UI design: **search boxes + quantity inputs = complete form.**

---

## Routes

```
/login

/onboarding                     → Phase A setup wizard (TBD — needs recordings)
/onboarding/config              → A1: technical config
/onboarding/masters             → A2: master data

/dashboard                      → hub + quick actions

# Sales
/sales/quick/new                → Quick Sale wizard (order + invoice in 1 step)
/sales/quick/:id                → Quick Sale result

/sales/orders                   → list
/sales/orders/new               → New Order wizard
/sales/orders/:id               → Order detail + Invoice button

/sales/invoices                 → list
/sales/invoices/:id             → Invoice detail

# Purchases
/purchases/quick/new            → Quick Purchase wizard
/purchases/quick/:id            → Quick Purchase result

/purchases/orders               → list
/purchases/orders/new           → New Purchase Order wizard
/purchases/orders/:id           → Order detail + Invoice button

/purchases/invoices             → list
/purchases/invoices/:id         → Invoice detail
```

---

## Screen Flows

### Dashboard

```
┌─────────────────────────────────────────────────────┐
│  Etendo Lite                              [logout]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌──────────────────┐   ┌──────────────────┐      │
│   │  ⚡ Quick Sale    │   │  ⚡ Quick Purchase│      │
│   │  invoice in 1 step│   │  invoice in 1 step│      │
│   └──────────────────┘   └──────────────────┘      │
│                                                     │
│   ┌──────────────────┐   ┌──────────────────┐      │
│   │  📋 New Order    │   │  📋 New PO        │      │
│   │  sales order     │   │  purchase order  │      │
│   └──────────────────┘   └──────────────────┘      │
│                                                     │
│  Recent Sales                   Recent Purchases   │
│  ┌─────────────────────┐   ┌─────────────────────┐ │
│  │ #1000373  Acme  CO  │   │ #10001745 VendA CO  │ │
│  │ #1000365  Beta  CO  │   │ #10001744 VendB CO  │ │
│  └─────────────────────┘   └─────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

### Quick Sale — Single Screen Wizard

```
/sales/quick/new

┌─────────────────────────────────────────────────────┐
│  ← Dashboard    Quick Sale                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Customer   [search by name or code...        ▼]   │
│              ↳ typeahead → GET /customers/search    │
│                                                     │
│  Date       [19/02/2026  ]                          │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  Products                                           │
│                                                     │
│  [search product...    ] [qty] [price] [total] [x]  │
│  Agua sin Gas 1L          12   $1.49   $17.88   ×  │
│  Leche Entera 1L           4   $0.98    $3.92   ×  │
│                                                     │
│  [+ Add product]                                    │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                           Subtotal    $21.80        │
│                           Tax         $4.58         │
│                           Total      $26.38         │
│                                                     │
│             [ Cancel ]   [ Confirm Sale ]           │
└─────────────────────────────────────────────────────┘

On confirm:
  POST /lite/sales/quick
  { customerId, date, lines: [{productId, quantity}] }

  Orchestration layer internally:
  1. GET customer → resolve address, priceList, paymentTerms
  2. GET product prices × N → resolve unitPrice, tax, uom
  3. POST Order (add) → orderId
  4. POST OrderLine × N (add)
  5. POST FormInit EDIT TAB=186 inpdocaction=CO → complete order
  6. POST Invoice (add) → invoiceId
  7. POST InvoiceLine × N (update, _new=true)
  8. POST FormInit EDIT TAB=263 inpdocaction=CO → complete invoice
```

**Success screen:**
```
┌─────────────────────────────────────────────────────┐
│  ✓ Sale completed                                   │
│                                                     │
│  Invoice #1000374                                   │
│  Acme Corp · 19/02/2026 · $26.38                   │
│                                                     │
│  [ View Invoice ]   [ New Sale ]   [ Dashboard ]   │
└─────────────────────────────────────────────────────┘
```

---

### Sales Order (separate flow)

```
/sales/orders/new   — same form as Quick Sale but only creates order

On confirm:
  POST /lite/sales/orders
  { customerId, date, lines: [{productId, quantity}] }
  → creates Order + lines + completes order


/sales/orders/:id

┌─────────────────────────────────────────────────────┐
│  ← Orders    Order #1000365            [CO] Complete│
├─────────────────────────────────────────────────────┤
│  Customer:   Acme Corp                              │
│  Date:       19/02/2026                             │
│  Warehouse:  Main Warehouse                         │
│                                                     │
│  Product           Qty    Price     Total           │
│  Agua sin Gas 1L    12    $1.49    $17.88            │
│  ─────────────────────────────────────────────────  │
│  Total                             $21.63           │
│                                                     │
│              [ Create Invoice ]                     │
└─────────────────────────────────────────────────────┘

"Create Invoice" button:
  POST /lite/sales/invoices { orderId }
  → creates Invoice from order data + completes it
  → redirect to /sales/invoices/:id
```

---

### Quick Purchase — same structure as Quick Sale

```
/purchases/quick/new

Same form, vendor instead of customer.

POST /lite/purchases/quick
  { vendorId, date, lines: [{productId, quantity}] }

Orchestration layer:
  1. GET vendor → resolve address, priceList, paymentTerms
  2. GET product prices × N (purchase price list)
  3. POST Order (purchase, add) → orderId
  4. POST OrderLine × N (add)
  5. POST FormInit EDIT TAB=294 inpdocaction=CO → complete PO
  6. POST Invoice (purchase, add) → invoiceId
  7. POST InvoiceLine × N (update, _new=true)
  8. POST FormInit EDIT TAB=290 inpdocaction=CO → complete purchase invoice
```

---

### Invoice Detail (sales or purchase)

```
/sales/invoices/:id

┌─────────────────────────────────────────────────────┐
│  ← Invoices   Invoice #1000373        [CO] Complete │
├─────────────────────────────────────────────────────┤
│  Customer:   Acme Corp                              │
│  Date:       19/02/2026                             │
│  Payment:    30 days · Bank transfer                │
│                                                     │
│  Product           Qty    Price     Total           │
│  Agua sin Gas 1L     4    $1.49     $5.96           │
│  ─────────────────────────────────────────────────  │
│  Subtotal                           $5.96           │
│  Tax (21%)                          $1.25           │
│  Total                              $7.21           │
└─────────────────────────────────────────────────────┘
```

---

## Component Structure

```
src/
├── api/
│   ├── client.ts         → base fetch with Basic Auth + tenant header
│   ├── customers.ts      → search, get
│   ├── vendors.ts        → search, get
│   ├── products.ts       → search (price-list aware)
│   ├── sales.ts          → quick, orders, invoices
│   └── purchases.ts      → quick, orders, invoices
│
├── components/
│   ├── SearchSelect.tsx   → reusable typeahead (customer, vendor, product)
│   ├── LineTable.tsx      → product lines with inline search + qty
│   ├── StatusBadge.tsx    → DR/CO/VO badge
│   ├── TotalSummary.tsx   → subtotal, tax, total
│   └── ConfirmButton.tsx  → loading state aware
│
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── sales/
│   │   ├── QuickSale.tsx
│   │   ├── OrderList.tsx
│   │   ├── OrderNew.tsx
│   │   ├── OrderDetail.tsx
│   │   ├── InvoiceList.tsx
│   │   └── InvoiceDetail.tsx
│   └── purchases/
│       ├── QuickPurchase.tsx
│       ├── OrderList.tsx
│       ├── OrderNew.tsx
│       ├── OrderDetail.tsx
│       ├── InvoiceList.tsx
│       └── InvoiceDetail.tsx
│
└── hooks/
    ├── useCustomerSearch.ts
    ├── useProductSearch.ts
    └── useVendorSearch.ts
```

---

## Orchestration Layer — Endpoints needed for this UI

```
POST   /lite/auth/login

# Quick flows (order + invoice in 1 shot)
POST   /lite/sales/quick
POST   /lite/purchases/quick

# Sales Orders
POST   /lite/sales/orders
GET    /lite/sales/orders
GET    /lite/sales/orders/:id

# Sales Invoices (from order or standalone)
POST   /lite/sales/invoices
GET    /lite/sales/invoices
GET    /lite/sales/invoices/:id

# Purchase Orders
POST   /lite/purchases/orders
GET    /lite/purchases/orders
GET    /lite/purchases/orders/:id

# Purchase Invoices
POST   /lite/purchases/invoices
GET    /lite/purchases/invoices
GET    /lite/purchases/invoices/:id

# Lookups
GET    /lite/masters/customers/search?q=
GET    /lite/masters/vendors/search?q=
GET    /lite/masters/products/search?q=
```

---

## What's still blocked (needs Phase A recordings)

The UI above works assuming Etendo is already configured.
The `/onboarding` flow requires Phase A recordings (setup_organization, setup_taxes, etc.)
Those can be built in parallel once recorded.

## Build order

1. **Orchestration Layer** — implement spec runner + endpoints
2. **Quick Sale + Quick Purchase** — highest value, covers 80% of use cases
3. **Order lists + detail** — for visibility into existing documents
4. **Onboarding wizard** — once Phase A recordings are done
