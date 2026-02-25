/**
 * purchases.js
 *
 * Purchase flows:
 *   POST /lite/purchases/invoices   → create purchase invoice + lines
 *   GET  /lite/purchases/invoices   → list purchase invoices
 *
 * Orchestration:
 *   1. GET vendor BPAddress (headless)
 *   2. POST PurchaseInvoice (headless)
 *   3. POST PurchaseInvoiceLine × N (headless, parallel)
 *      - uOM taken from product
 *      - tax resolved from product.taxCategory → TaxRate (salesPurchaseType P)
 */

import { Router } from 'express'
import { getTenant } from '../tenants.js'
import { makeHeadlessClient } from '../etendo.js'

export const purchasesRouter = Router()

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getVendorAddress(headless, vendorId) {
  const data = await headless.get('BPAddress', `businessPartner=="${vendorId}"`, {
    _startRow: 0, _endRow: 1,
  })
  return data.response?.data?.[0] ?? null
}

async function resolveProductTax(headless, productId, type = 'P') {
  const prodData = await headless.get('Product', `id=="${productId}"`, { _startRow: 0, _endRow: 1 })
  const prod = prodData.response?.data?.[0]
  if (!prod?.taxCategory) return null

  const taxFilters = [
    'summaryLevel==false',
    'withholdingTax==false',
    `taxCategory=="${prod.taxCategory}"`,
    type === 'P'
      ? '(salesPurchaseType=="P",salesPurchaseType=="B")'
      : '(salesPurchaseType=="S",salesPurchaseType=="B")',
  ].join(';')

  const taxData = await headless.get('TaxRate', taxFilters, { _startRow: 0, _endRow: 50 })
  const taxes = taxData.response?.data ?? []

  // Pick: no country restriction, no BP tax category, most recent validFromDate
  const candidates = taxes
    .filter(t => !t.country && !t.destinationCountry && !t.businessPartnerTaxCategory && t.rate >= 0)
    .sort((a, b) => b.validFromDate.localeCompare(a.validFromDate))

  return { uOM: prod.uOM, taxId: candidates[0]?.id ?? null }
}

function ok(res) {
  const status = res?.status ?? res?.response?.status
  if (status !== 0) throw new Error(JSON.stringify(res?.response?.error ?? res))
  return res.response.data[0]
}

// ── POST /lite/purchases/invoices ─────────────────────────────────────────────

purchasesRouter.post('/invoices', async (req, res, next) => {
  // #swagger.tags = ['Purchases']
  // #swagger.summary = 'Crear factura de compra. Body: { vendorId, date?, description?, lines: [{productId, quantity, unitPrice, taxId?}] }'
  try {
    const { vendorId, date, description, lines } = req.body

    if (!vendorId) return res.status(400).json({ error: 'vendorId is required' })
    if (!lines?.length) return res.status(400).json({ error: 'lines must not be empty' })

    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const today    = date ?? new Date().toISOString().split('T')[0]

    // 1. Vendor address + product details (parallel)
    const [addr, ...productMeta] = await Promise.all([
      getVendorAddress(headless, vendorId),
      ...lines.map(l => resolveProductTax(headless, l.productId, 'P')),
    ])

    if (!addr) return res.status(400).json({ error: `No address found for vendor ${vendorId}` })

    // 2. Create invoice header
    const pi = ok(await headless.post('PurchaseInvoice', {
      organization:    tenant.organization,
      businessPartner: vendorId,
      partnerAddress:  addr.id,
      invoiceDate:     today,
      description:     description ?? null,
    }))

    // 3. Create lines (parallel)
    const lineResults = await Promise.all(lines.map((line, i) => {
      const meta = productMeta[i]
      return headless.post('PurchaseInvoiceLine', {
        invoice:          pi.id,
        product:          line.productId,
        invoicedQuantity: line.quantity,
        unitPrice:        line.unitPrice,
        uOM:              meta?.uOM ?? '100',
        tax:              line.taxId ?? meta?.taxId ?? null,
        description:      line.description ?? null,
      })
    }))

    const createdLines = lineResults.map(r => ok(r))

    res.status(201).json({
      invoiceId:   pi.id,
      documentNo:  pi.documentNo,
      status:      pi.documentStatus ?? 'DR',
      vendorId,
      lines: createdLines.map(l => ({
        id:            l.id,
        lineNetAmount: l.lineNetAmount,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// ── GET /lite/purchases/invoices ──────────────────────────────────────────────

purchasesRouter.get('/invoices', async (req, res, next) => {
  // #swagger.tags = ['Purchases']
  // #swagger.summary = 'Listar facturas de compra'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { vendorId, status, _startRow = 0, _endRow = 50 } = req.query

    const filters = []
    if (vendorId) filters.push(`businessPartner=="${vendorId}"`)
    if (status)   filters.push(`documentStatus=="${status}"`)

    const data = await headless.get('PurchaseInvoice', filters.join(';'), {
      _startRow, _endRow,
    })

    const rows = data.response?.data ?? []
    res.json({
      total: data.response?.totalRows ?? rows.length,
      data: rows.map(inv => ({
        id:          inv.id,
        documentNo:  inv.documentNo,
        invoiceDate: inv.invoiceDate,
        vendor:      inv['businessPartner$_identifier'],
        vendorId:    inv.businessPartner,
        status:      inv.documentStatus,
        grandTotal:  inv.grandTotalAmount,
        currency:    inv['currency$_identifier'],
      })),
    })
  } catch (err) {
    next(err)
  }
})
