/**
 * sales.js — Sales flows
 *
 * POST /lite/sales/orders         → create + complete sales order
 * GET  /lite/sales/orders         → list sales orders
 * POST /lite/sales/invoices       → create sales invoice + lines
 * GET  /lite/sales/invoices       → list sales invoices
 *
 * Order orchestration flow:
 *  1. GET Customer (headless)        → partnerAddress, priceList, paymentTerms, paymentMethod
 *  2. GET CustomerLocation (headless) → partnerAddressId
 *  3. GET Product prices × N (headless, parallel) → unitPrice, uOM
 *  4. POST SalesOrder (headless)     → orderId, documentNo
 *  5. POST SalesOrderLine × N (headless, parallel)
 *  6. POST FormInit CO (kernel)      → completes order (no headless equivalent)
 *
 * All DataSource steps (1–5) use the EtendoRX headless API:
 *   /etendo/sws/com.etendoerp.etendorx.datasource/{endpoint}
 * CSRF is handled internally by the headless servlet — callers send nothing extra.
 * NOTE: SL_Order_Product callout has a null-check fix (order == null → early return)
 * so it no longer NPEs when inpcOrderId is missing from the request context.
 *
 * Step 6 uses FormInitializationComponent, which has no headless equivalent.
 * It requires a JSESSIONID cookie (obtained transparently by makeClient).
 *
 * Headless endpoint → Etendo tab mapping (configured via headless-setup.sql):
 *   Customer         → C_BPartner      (tab 220)
 *   CustomerLocation → C_BPartner_Location (tab 222)
 *   SalesOrder       → C_Order         (tab 186)
 *   SalesOrderLine   → C_OrderLine     (tab 187)
 */

import { Router } from 'express'
import { getTenant } from '../tenants.js'
import { makeHeadlessClient, makeClient } from '../etendo.js'

export const salesRouter = Router()

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert YYYY-MM-DD to DD-MM-YYYY (Etendo FormInit inp* format) */
function toFormDate(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${d}-${m}-${y}`
}

/**
 * Resolve customer financial fields from BPCustomer (tab 223).
 * BPCustomer is the customer-specific subtab of C_BPartner.
 * Its id == c_bpartner_id (same record, different tab).
 * Returns: priceList, paymentTerms, paymentMethod, formOfPayment, currency.
 */
async function getCustomerDetails(headless, customerId) {
  const data = await headless.get('BPCustomer', `id=="${customerId}"`, {
    _startRow: 0,
    _endRow: 1,
  })
  const bp = data.response?.data?.[0]
  if (!bp) throw new Error(`Customer ${customerId} not found`)
  return bp
}

/**
 * Resolve invoice-to address from BPAddress (tab 222).
 * Filter: businessPartner == customerId AND invoiceToAddress == true.
 */
async function getCustomerLocation(headless, customerId) {
  const data = await headless.get(
    'BPAddress',
    `businessPartner=="${customerId}" and invoiceToAddress==true`,
    { _startRow: 0, _endRow: 1 }
  )
  return data.response?.data?.[0] ?? null
}

/**
 * Resolve product unit price and UOM from the classic DataSource selector.
 * ProductByPriceAndWarehouse is a selector datasource that doesn't have a
 * headless endpoint — using classic GET (no CSRF needed for GETs).
 */
async function getProductPrice(classic, tenant, productId, priceListId) {
  const data = await classic.get(
    '/etendo/org.openbravo.service.datasource/ProductByPriceAndWarehouse',
    {
      _operationType: 'fetch',
      _startRow: 0,
      _endRow: 1,
      _selectorDefinitionId: tenant.productSelectorId,
      targetProperty: 'product',
      columnName: 'M_Product_ID',
      inpmPricelistId: priceListId,
      inpmWarehouseId: tenant.warehouse,
      criteria: JSON.stringify([
        { fieldName: 'product',   operator: 'equals', value: productId      },
        { fieldName: 'warehouse', operator: 'equals', value: tenant.warehouse },
      ]),
    }
  )
  const item = data.response?.data?.[0]
  if (!item) throw new Error(`Product ${productId} not found in price list`)
  return {
    unitPrice: item.netListPrice ?? item.standardPrice ?? 0,
    uom:       item['product$uOM$id'] ?? '100',
  }
}

// ── POST /lite/sales/orders ──────────────────────────────────────────────────
salesRouter.post('/orders', async (req, res, next) => {
  // #swagger.tags = ['Sales']
  // #swagger.summary = 'Crear orden de venta (→ CO). Body: { customerId, date?, lines: [{productId, quantity}] }'
  try {
    const { customerId, date, lines } = req.body

    if (!customerId) return res.status(400).json({ error: 'customerId is required' })
    if (!lines?.length) return res.status(400).json({ error: 'lines must not be empty' })

    const tenant  = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const classic  = makeClient(tenant.etendoUrl, tenant.classicAuth ?? req.etendoAuth) // needed for step 3 (ProductByPriceAndWarehouse)
    const today = date ?? new Date().toISOString().split('T')[0]
    const t0 = Date.now()
    const elapsed = () => `+${Date.now() - t0}ms`

    // ── Steps 1+2: Resolve customer + address (parallel) ───────────────────
    const [bp, location] = await Promise.all([
      getCustomerDetails(headless, customerId),
      getCustomerLocation(headless, customerId),
    ])
    console.log(`  [1+2] customer + address resolved ${elapsed()}`)

    let priceListId        = bp.priceList
    const paymentTermsId   = bp.paymentTerms
    const paymentMethodId  = bp.paymentMethod
    const currency         = bp.currency ?? tenant.currency
    const partnerAddressId = location?.id ?? null

    // If customer has no price list, derive it from the tenant's default PriceListVersion
    if (!priceListId && tenant.defaultPriceListVersionId) {
      const plvData = await headless.get(
        'PriceListVersion',
        `id=="${tenant.defaultPriceListVersionId}"`,
        { _startRow: 0, _endRow: 1 }
      )
      priceListId = plvData.response?.data?.[0]?.priceList ?? null
      if (priceListId) console.log(`  [1+2] priceList derived from defaultPriceListVersionId: ${priceListId}`)
    }
    if (!priceListId) throw new Error('No price list found for customer and no default configured')

    // ── Step 3: Resolve product prices + tax (parallel) ────────────────────
    const productDetails = await Promise.all(
      lines.map(async line => {
        const [price, meta] = await Promise.all([
          getProductPrice(classic, tenant, line.productId, priceListId),
          resolveProductMeta(headless, line.productId),
        ])
        return { ...price, taxId: meta.taxId, uom: meta.uOM ?? price.uom }
      })
    )
    console.log(`  [3] ${lines.length} product(s) resolved ${elapsed()}`)

    // ── Step 4: Create Order header (headless POST) ─────────────────────────
    // Only include fields configured in the SalesOrder headless endpoint.
    // Extra/unknown fields (ORDERTYPE, DOCBASETYPE) pass through keyConvertion()
    // unchanged and cause the DataSource save to throw, rolling back the transaction
    // even though the 200 response has already been committed.
    const orderRes = await headless.post('SalesOrder', {
      organization:          tenant.organization,
      client:                tenant.client,
      transactionDocument:   tenant.salesOrderDocType,
      orderDate:             today,
      scheduledDeliveryDate: today,
      accountingDate:        today,
      businessPartner:       customerId,
      partnerAddress:        partnerAddressId,
      invoiceAddress:        partnerAddressId,
      priceList:             priceListId,
      paymentTerms:          paymentTermsId,
      paymentMethod:         paymentMethodId,
      currency:              currency,
      warehouse:             tenant.warehouse,
      userContact:           tenant.userContactId,
      documentStatus:        'DR',
    })

    if (orderRes.status !== 0) {
      console.error('[sales] SalesOrder POST response:', JSON.stringify(orderRes))
      throw new Error('Order creation failed: ' + JSON.stringify(orderRes.response?.error ?? orderRes))
    }

    const order      = orderRes.response.data[0]
    const orderId    = order.id
    const documentNo = order.documentNo
    const docTypeId  = order.transactionDocument ?? tenant.salesOrderDocType

    console.log(`  [4] order ${documentNo} created ${elapsed()}`)

    // ── Step 5: Create OrderLines (headless POST, sequential) ───────────────
    // SalesOrderLines endpoint has 4 configured fields: C_Order_ID, M_Product_ID,
    // PriceActual, QtyOrdered. We send only these + minimal extras needed.
    // Sequential (not parallel) to avoid transaction conflicts.
    for (let i = 0; i < lines.length; i++) {
      const line      = lines[i]
      const product   = productDetails[i]
      const netAmount = Math.round(line.quantity * product.unitPrice * 100) / 100

      console.log(`  [line ${i + 1}] ${line.productId} × ${line.quantity} @ ${product.unitPrice}`)

      await headless.post('SalesOrderLines', {
        salesOrder:      orderId,
        product:         line.productId,
        orderedQuantity: line.quantity,
        unitPrice:       product.unitPrice,
        uOM:             product.uom,
        lineNetAmount:   netAmount,
        ...(product.taxId ? { tax: product.taxId } : {}),
      })
    }
    console.log(`  [5] lines created — order ${documentNo} saved as Draft ${elapsed()}`)

    res.json({ orderId, documentNo, status: 'DR' })
  } catch (err) {
    next(err)
  }
})

// ── POST /lite/sales/orders/:id/complete ─────────────────────────────────────
salesRouter.post('/orders/:id/complete', async (req, res, next) => {
  // #swagger.tags = ['Sales']
  // #swagger.summary = 'Completar orden de venta (DR → CO via FormInit)'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const classic  = makeClient(tenant.etendoUrl, tenant.classicAuth ?? req.etendoAuth)

    // Fetch the order to get all fields needed for FormInit
    const orderData = await headless.get('SalesOrder', `id=="${req.params.id}"`, { _startRow: 0, _endRow: 1 })
    const order = orderData.response?.data?.[0]
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.documentStatus !== 'DR') {
      return res.status(400).json({ error: `Order is not in Draft status (current: ${order.documentStatus})` })
    }

    const orderId    = order.id
    const documentNo = order.documentNo
    const rawDate    = order.orderDate ?? new Date().toISOString()
    const today      = rawDate.split('T')[0]
    const formDate   = toFormDate(today)
    const docTypeId  = order.transactionDocument ?? tenant.salesOrderDocType

    await classic.postForm(
      `/etendo/org.openbravo.client.kernel` +
      `?MODE=EDIT&TAB_ID=186&PARENT_ID=null&ROW_ID=${orderId}` +
      `&_action=org.openbravo.client.application.window.FormInitializationComponent`,
      {
        inpcOrderId:            orderId,
        C_Order_ID:             orderId,
        inpadClientId:          tenant.client,
        inpadOrgId:             tenant.organization,
        inpcDoctypetargetId:    docTypeId,
        inpcDoctypeId:          docTypeId,
        inpdocumentno:          documentNo,
        inpdateordered:         formDate,
        inpdatepromised:        formDate,
        inpdateacct:            formDate,
        inpcBpartnerId:         order.businessPartner,
        inpcBpartnerLocationId: order.partnerAddress ?? null,
        inpbilltoId:            order.invoiceAddress ?? order.partnerAddress ?? null,
        inpmPricelistId:        order.priceList,
        inpcPaymenttermId:      order.paymentTerms,
        inpfinPaymentmethodId:  order.paymentMethod,
        inpcCurrencyId:         order.currency ?? tenant.currency,
        inpmWarehouseId:        tenant.warehouse,
        inpdocaction:           'CO',
        inpdocstatus:           'DR',
        inpissotrx:             'Y',
        inpprocessed:           'N',
        inpposted:              'N',
        inpinvoicerule:         'D',
        inppaymentrule:         'P',
        inpdeliveryrule:        'A',
        inpdeliveryviarule:     'P',
        inpfreightcostrule:     'I',
        inppriorityrule:        '5',
        inpisdiscountprinted:   'N',
        inpprocessing:          'N',
        inpTabId:               '186',
        inpwindowId:            '143',
        inpTableId:             '259',
        inpkeyColumnId:         'C_Order_ID',
        keyProperty:            'id',
        ORDERTYPE:              'SO',
        DOCBASETYPE:            'SOO',
        PromotionsDefined:      'N',
      }
    )
    console.log(`  [complete] order ${documentNo} → CO`)

    res.json({ orderId, documentNo, status: 'CO' })
  } catch (err) { next(err) }
})

// ── POST /lite/sales/invoices ─────────────────────────────────────────────────
//
// Body: { customerId, date?, description?, lines: [{ productId, quantity, unitPrice?, taxId? }] }
//
// Orchestration:
//   1. GET customer BPAddress (headless)
//   2. POST SalesInvoice header (headless)
//   3. POST SalesInvoiceLine × N (headless, parallel)
//      - unitPrice: from body or falls back to 0 (caller must provide it for sales)
//      - uOM + tax: auto-resolved from product.taxCategory (type S)

async function resolveProductMeta(headless, productId) {
  const prodData = await headless.get('Product', `id=="${productId}"`, { _startRow: 0, _endRow: 1 })
  const prod = prodData.response?.data?.[0]
  if (!prod) return { uOM: '100', taxId: null }
  if (!prod.taxCategory) return { uOM: prod.uOM ?? '100', taxId: null }

  const taxFilters = [
    'summaryLevel==false',
    'withholdingTax==false',
    `taxCategory=="${prod.taxCategory}"`,
    '(salesPurchaseType=="S",salesPurchaseType=="B")',
  ].join(';')

  const taxData = await headless.get('TaxRate', taxFilters, { _startRow: 0, _endRow: 50 })
  const candidates = (taxData.response?.data ?? [])
    .filter(t => !t.country && !t.destinationCountry && !t.businessPartnerTaxCategory && t.rate >= 0)
    .sort((a, b) => b.validFromDate.localeCompare(a.validFromDate))

  return { uOM: prod.uOM ?? '100', taxId: candidates[0]?.id ?? null }
}

function okInvoice(res) {
  const status = res?.status ?? res?.response?.status
  if (status !== 0) throw new Error(JSON.stringify(res?.response?.error ?? res))
  return res.response.data[0]
}

salesRouter.post('/invoices', async (req, res, next) => {
  // #swagger.tags = ['Sales']
  // #swagger.summary = 'Crear factura de venta. Body: { customerId, date?, description?, lines: [{productId, quantity, unitPrice, taxId?}] }'
  try {
    const { customerId, date, description, lines } = req.body

    if (!customerId) return res.status(400).json({ error: 'customerId is required' })
    if (!lines?.length) return res.status(400).json({ error: 'lines must not be empty' })

    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const today    = date ?? new Date().toISOString().split('T')[0]

    // 1. Customer address + product meta (parallel)
    const [addrData, ...productMeta] = await Promise.all([
      headless.get('BPAddress', `businessPartner=="${customerId}";invoiceToAddress==true`, { _startRow: 0, _endRow: 1 }),
      ...lines.map(l => resolveProductMeta(headless, l.productId)),
    ])

    const addr = addrData.response?.data?.[0]
    if (!addr) return res.status(400).json({ error: `No invoice address found for customer ${customerId}` })

    // 2. Create invoice header
    const inv = okInvoice(await headless.post('SalesInvoice', {
      organization:    tenant.organization,
      businessPartner: customerId,
      partnerAddress:  addr.id,
      invoiceDate:     today,
      description:     description ?? null,
    }))

    // 3. Create lines (parallel)
    const lineResults = await Promise.all(lines.map((line, i) => {
      const meta = productMeta[i]
      return headless.post('SalesInvoiceLine', {
        invoice:          inv.id,
        product:          line.productId,
        invoicedQuantity: line.quantity,
        unitPrice:        line.unitPrice ?? 0,
        uOM:              meta?.uOM ?? '100',
        tax:              line.taxId ?? meta?.taxId ?? null,
        description:      line.description ?? null,
      })
    }))

    const createdLines = lineResults.map(r => okInvoice(r))

    res.status(201).json({
      invoiceId:  inv.id,
      documentNo: inv.documentNo,
      status:     inv.documentStatus ?? 'DR',
      customerId,
      lines: createdLines.map(l => ({ id: l.id, lineNetAmount: l.lineNetAmount })),
    })
  } catch (err) { next(err) }
})

// ── GET /lite/sales/invoices ──────────────────────────────────────────────────

salesRouter.get('/invoices', async (req, res, next) => {
  // #swagger.tags = ['Sales']
  // #swagger.summary = 'Listar facturas de venta'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { customerId, status, _startRow = 0, _endRow = 50 } = req.query

    const filters = []
    if (customerId) filters.push(`businessPartner=="${customerId}"`)
    if (status)     filters.push(`documentStatus=="${status}"`)

    const data = await headless.get('SalesInvoice', filters.join(';'), { _startRow, _endRow })
    const rows = data.response?.data ?? []

    res.json({
      total: data.response?.totalRows ?? rows.length,
      data: rows.map(inv => ({
        id:          inv.id,
        documentNo:  inv.documentNo,
        invoiceDate: inv.invoiceDate,
        customer:    inv['businessPartner$_identifier'],
        customerId:  inv.businessPartner,
        status:      inv.documentStatus,
        grandTotal:  inv.grandTotalAmount,
        currency:    inv['currency$_identifier'],
      })),
    })
  } catch (err) { next(err) }
})

// ── GET /lite/sales/orders ────────────────────────────────────────────────────

salesRouter.get('/orders', async (req, res, next) => {
  // #swagger.tags = ['Sales']
  // #swagger.summary = 'Listar órdenes de venta'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { customerId, status, _startRow = 0, _endRow = 50 } = req.query

    const filters = []
    if (customerId) filters.push(`businessPartner=="${customerId}"`)
    if (status)     filters.push(`documentStatus=="${status}"`)

    const data = await headless.get('SalesOrder', filters.join(';'), { _startRow, _endRow })
    const rows = data.response?.data ?? []

    res.json({
      total: data.response?.totalRows ?? rows.length,
      data: rows.map(o => ({
        id:          o.id,
        documentNo:  o.documentNo,
        orderDate:   o.orderDate,
        customer:    o['businessPartner$_identifier'],
        customerId:  o.businessPartner,
        status:      o.documentStatus,
        grandTotal:  o.grandTotalAmount,
        currency:    o['currency$_identifier'],
      })),
    })
  } catch (err) { next(err) }
})
