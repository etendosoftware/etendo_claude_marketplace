#!/usr/bin/env node
/**
 * full-cycle.js
 *
 * Non-interactive end-to-end demo of the Etendo Lite headless API.
 * Covers the complete Sales + Purchase cycle:
 *
 * SALES:
 *   1. Create Customer  (BusinessPartner → BPCustomer)
 *   2. Create Sales Order + Lines  (SalesOrder → SalesOrderLines)
 *   3. Complete Sales Order  (FormInit CO)
 *
 * PURCHASE:
 *   4. Create Vendor  (BusinessPartner → BPVendor)
 *   5. Create Purchase Order + Lines  (PurchaseOrder → PurchaseOrderLines)
 *   6. Create Purchase Invoice + Lines  (PurchaseInvoice → PurchaseInvoiceLine)
 *
 * Note: Sales Invoice Flow is currently broken in the server (deleted ADField).
 *
 * Usage:
 *   node scripts/full-cycle.js
 *
 * Requires Etendo running at http://localhost:8080 with demo data.
 */

import { makeHeadlessClient, makeClient } from '../server/src/etendo.js'

// ── Config ───────────────────────────────────────────────────────────────────

const ETENDO_URL   = 'http://localhost:8080'
const BASIC_AUTH   = 'Basic ' + Buffer.from('admin:admin').toString('base64')
// Role for demo data: F&B International Group Admin
// (System Administrator role returns AccessTableNoView for business data)
const LOGIN_ROLE   = '42D0EEB1C66F497A90DD526DC597E6F0'
const TODAY        = new Date().toISOString().split('T')[0]
const SUFFIX       = Date.now().toString().slice(-6) // unique suffix per run

// F&B España - Región Norte (demo data)
const ORG          = 'E443A31992CB4635AFCAEABE7183CE85'

// Price lists
const SALES_PRICE_LIST    = '8366EAF1EDF442A98377D74A199084A8' // General Sales (SO)
const PURCHASE_PRICE_LIST = '1D8D2464FE974C41812CF0128C160CB3' // Fruit & Bio is Life (PO)

// Payment
const PAYMENT_TERMS  = '66BA1164A7394344BB9CD1A6ECEED05D' // 30 days
const PAYMENT_METHOD = '15263EF498404ED3BEA2077023A4B68C' // Wire Transfer

// Products (demo)
const PRODUCT_1 = '20FBF069AC804DE9BF16670000B9562E' // Cherry Cola
const PRODUCT_2 = '0DC5C5281B3643DEAB978EB04139516B' // Orange Juice bio

// ── SWS Login (obtain JWT Bearer token) ──────────────────────────────────────

async function sswLogin() {
  const res = await fetch(`${ETENDO_URL}/etendo/sws/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin', role: LOGIN_ROLE }),
  })
  const data = await res.json()
  if (data.status !== 'success') throw new Error('SWS login failed: ' + data.message)
  return 'Bearer ' + data.token
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// headless and classic are initialized after login (see main())
let headless, classic

function toFormDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function log(step, msg, data) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`[${step}] ${msg}`)
  if (data) console.log(JSON.stringify(data, null, 2))
}

function ok(res) {
  // POST responses: { response: { data: [...] }, status: 0 }
  // GET responses:  { response: { data: [...], status: 0 } }
  const status = res?.status ?? res?.response?.status
  if (status !== 0) {
    throw new Error('API error: ' + JSON.stringify(res?.response?.error ?? res))
  }
  const d = res?.response
  return d?.data?.[0] ?? d?.data
}

// ── SALES CYCLE ──────────────────────────────────────────────────────────────

async function salesCycle() {
  console.log('\n' + '═'.repeat(60))
  console.log('SALES CYCLE')
  console.log('═'.repeat(60))

  // ── Step 1a: Create Customer (BusinessPartner) ──────────────────────────
  log('1a', 'Creating BusinessPartner (customer)...')
  const bpRes = await headless.post('BusinessPartner', {
    organization: ORG,
    name:         `Test Customer ${SUFFIX}`,
    searchKey:    `TESTCUST${SUFFIX}`,
    taxID:        `B${SUFFIX}`,
  })
  const bp = ok(bpRes)
  log('1a', `BusinessPartner created → id: ${bp.id}`, { name: bp.name, id: bp.id })

  // ── Step 1b: Set customer-specific fields (BPCustomer) ─────────────────
  // BPCustomer tab (223) shares the same record as C_BPartner.
  // POST with existing id acts as upsert (PUT returns ActionNotAllowed).
  log('1b', 'Setting customer fields (BPCustomer POST upsert)...')
  const bpcRes = await headless.post('BPCustomer', {
    id:            bp.id,
    customer:      true,
    priceList:     SALES_PRICE_LIST,
    paymentTerms:  PAYMENT_TERMS,
    paymentMethod: PAYMENT_METHOD,
    creditLimit:   10000,
    active:        true,
  })
  const bpc = ok(bpcRes)
  log('1b', `BPCustomer updated → priceList set`, { id: bpc.id })

  // ── Step 1c: Create customer address (BPAddress) ────────────────────────
  // SalesOrder requires c_bpartner_location_id (NOT NULL constraint).
  // We need at least one address for the newly created BP.
  log('1c', 'Creating BPAddress...')
  const addrRes = await headless.post('BPAddress', {
    businessPartner:  bp.id,
    organization:     ORG,
    name:             `Main Address`,
    invoiceToAddress: true,
    shipToAddress:    true,
  })
  const addr = ok(addrRes)
  log('1c', `BPAddress created → id: ${addr.id}`)

  // ── Step 2a: Create Sales Order header ─────────────────────────────────
  log('2a', 'Creating SalesOrder...')
  const orderRes = await headless.post('SalesOrder', {
    organization:   ORG,
    businessPartner: bp.id,
    partnerAddress:  addr.id,
    orderDate:       TODAY,
    orderReference:  `REF-${SUFFIX}`,
  })
  const order = ok(orderRes)
  log('2a', `SalesOrder created → ${order.documentNo}`, {
    id: order.id, documentNo: order.documentNo, status: order.documentStatus,
  })

  // ── Step 2b: Create Sales Order Lines ──────────────────────────────────
  log('2b', 'Creating SalesOrderLines (parallel)...')
  const lineResults = await Promise.all([
    headless.post('SalesOrderLines', {
      salesOrder:       order.id,
      product:          PRODUCT_1,
      orderedQuantity:  3,
      unitPrice:        1.99,
      uOM:              '100', // Each (demo products UOM)
    }),
    headless.post('SalesOrderLines', {
      salesOrder:       order.id,
      product:          PRODUCT_2,
      orderedQuantity:  2,
      unitPrice:        2.49,
      uOM:              '100',
    }),
  ])
  lineResults.forEach((r, i) => {
    const line = ok(r)
    log('2b', `Line ${i + 1} created`, { id: line.id, product: line.product, qty: line.orderedQuantity })
  })

  // ── Step 3: Complete Sales Order (FormInit CO) ──────────────────────────
  // No headless equivalent — requires FormInit + JSESSIONID.
  log('3', 'Completing Sales Order (FormInit CO)...')
  const formDate = toFormDate(TODAY)
  const coRes = await classic.postForm(
    `/etendo/org.openbravo.client.kernel` +
    `?MODE=EDIT&TAB_ID=186&PARENT_ID=null&ROW_ID=${order.id}` +
    `&_action=org.openbravo.client.application.window.FormInitializationComponent`,
    {
      inpcOrderId:    order.id,
      C_Order_ID:     order.id,
      inpadClientId:  '23C59575B9CF467C9620760EB255B389',
      inpadOrgId:     ORG,
      inpdocumentno:  order.documentNo,
      inpdateordered: formDate,
      inpdatepromised: formDate,
      inpdateacct:    formDate,
      inpcBpartnerId: bp.id,
      inpdocaction:   'CO',
      inpdocstatus:   'DR',
      inpissotrx:     'Y',
      inpTabId:       '186',
      inpwindowId:    '143',
      inpTableId:     '259',
      inpkeyColumnId: 'C_Order_ID',
      keyProperty:    'id',
      ORDERTYPE:      'SO',
      DOCBASETYPE:    'SOO',
    }
  )
  log('3', `Sales Order ${order.documentNo} → CO (completed)`,
    { status: coRes?.response?.status })

  return { customerId: bp.id, salesOrderId: order.id, documentNo: order.documentNo }
}

// ── PURCHASE CYCLE ───────────────────────────────────────────────────────────

async function purchaseCycle() {
  console.log('\n' + '═'.repeat(60))
  console.log('PURCHASE CYCLE')
  console.log('═'.repeat(60))

  // ── Step 4a: Create Vendor (BusinessPartner) ────────────────────────────
  log('4a', 'Creating BusinessPartner (vendor)...')
  const bpRes = await headless.post('BusinessPartner', {
    organization: ORG,
    name:         `Test Vendor ${SUFFIX}`,
    searchKey:    `TESTVEN${SUFFIX}`,
    taxID:        `A${SUFFIX}`,
  })
  const bp = ok(bpRes)
  log('4a', `BusinessPartner created → id: ${bp.id}`, { name: bp.name, id: bp.id })

  // ── Step 4b: Set vendor-specific fields (BPVendor) ─────────────────────
  // BPVendor POST with existing id acts as upsert (same pattern as BPCustomer).
  log('4b', 'Setting vendor fields (BPVendor POST upsert)...')
  const bpvRes = await headless.post('BPVendor', {
    id:                bp.id,
    vendor:            true,
    purchasePricelist: PURCHASE_PRICE_LIST,
  })
  const bpv = ok(bpvRes)
  log('4b', `BPVendor updated → vendor=true`, { id: bpv.id })

  // ── Step 4c: Create vendor address (BPAddress) ─────────────────────────
  log('4c', 'Creating BPAddress for vendor...')
  const vaddrRes = await headless.post('BPAddress', {
    businessPartner:  bp.id,
    organization:     ORG,
    name:             'Main Address',
    payFromAddress:   true,
    remitToAddress:   true,
  })
  const vaddr = ok(vaddrRes)
  log('4c', `BPAddress created → id: ${vaddr.id}`)

  // ── Step 5a: Create Purchase Order header ──────────────────────────────
  log('5a', 'Creating PurchaseOrder...')
  const poRes = await headless.post('PurchaseOrder', {
    organization:    ORG,
    businessPartner: bp.id,
    partnerAddress:  vaddr.id,
    orderDate:       TODAY,
    orderReference:  `PO-REF-${SUFFIX}`,
  })
  const po = ok(poRes)
  log('5a', `PurchaseOrder created → ${po.documentNo}`, {
    id: po.id, documentNo: po.documentNo, status: po.documentStatus,
  })

  // ── Step 5b: Create Purchase Order Lines ───────────────────────────────
  // Note: PurchaseOrderLines uses field name 'salesOrder' for the order FK (API quirk)
  log('5b', 'Creating PurchaseOrderLines...')
  const polRes = await headless.post('PurchaseOrderLines', {
    salesOrder:       po.id,   // 'salesOrder' = purchase order FK (naming quirk in API)
    product:          PRODUCT_1,
    orderedQuantity:  10,
    unitPrice:        0.89,
    uOM:              '100',
  })
  const pol = ok(polRes)
  log('5b', `PurchaseOrderLine created`, { id: pol.id, product: pol.product })

  // ── Step 6a: Create Purchase Invoice header ─────────────────────────────
  log('6a', 'Creating PurchaseInvoice...')
  const piRes = await headless.post('PurchaseInvoice', {
    organization:    ORG,
    businessPartner: bp.id,
    invoiceDate:     TODAY,
    orderReference:  `INV-${SUFFIX}`,
    description:     `Invoice for PO ${po.documentNo}`,
  })
  const pi = ok(piRes)
  log('6a', `PurchaseInvoice created → ${pi.documentNo}`, {
    id: pi.id, documentNo: pi.documentNo, status: pi.documentStatus,
  })

  // ── Step 6b: Create Purchase Invoice Lines ─────────────────────────────
  log('6b', 'Creating PurchaseInvoiceLine...')
  const pilRes = await headless.post('PurchaseInvoiceLine', {
    invoice:          pi.id,
    product:          PRODUCT_1,
    invoicedQuantity: 10,
    unitPrice:        0.89,
    uOM:              '100',
    tax:              '18A499249FF74A68B79510F0AD341141', // Adquisiciones IVA 21% (F&B España)
    description:      'Cherry Cola x10',
  })
  const pil = ok(pilRes)
  log('6b', `PurchaseInvoiceLine created`, { id: pil.id, lineNetAmount: pil.lineNetAmount })

  return {
    vendorId:          bp.id,
    purchaseOrderId:   po.id,
    purchaseInvoiceId: pi.id,
    documentNo:        pi.documentNo,
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Etendo Lite — Full Cycle Demo')
  console.log(`Date: ${TODAY} | Suffix: ${SUFFIX}`)

  // Obtain JWT Bearer token (SWS requires Bearer, not Basic Auth)
  const jwtAuth = await sswLogin()
  headless = makeHeadlessClient(ETENDO_URL, jwtAuth)
  classic  = makeClient(ETENDO_URL, BASIC_AUTH)

  try {
    const sales = await salesCycle()
    const purchase = await purchaseCycle()

    console.log('\n' + '═'.repeat(60))
    console.log('SUMMARY')
    console.log('═'.repeat(60))
    console.log('Sales:')
    console.log(`  Customer:     ${sales.customerId}`)
    console.log(`  Sales Order:  ${sales.documentNo} (${sales.salesOrderId})`)
    console.log('Purchase:')
    console.log(`  Vendor:          ${purchase.vendorId}`)
    console.log(`  Purchase Order:  ${purchase.purchaseOrderId}`)
    console.log(`  Purchase Invoice: ${purchase.documentNo} (${purchase.purchaseInvoiceId})`)
    console.log('\n✓ Full cycle completed successfully')
  } catch (err) {
    console.error('\n✗ Cycle failed:', err.message)
    process.exit(1)
  }
}

main()
