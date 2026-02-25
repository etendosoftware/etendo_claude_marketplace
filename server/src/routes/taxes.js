import { Router } from 'express'
import { makeHeadlessClient } from '../etendo.js'
import { getTenant } from '../tenants.js'

export const taxesRouter = Router()

/**
 * GET /lite/taxes
 *
 * Returns applicable tax rates, optionally filtered.
 *
 * Query params:
 *   type         P | S | B     (Purchase / Sales / Both) — default: B (all)
 *   taxCategory  <id>          Filter by product's taxCategory ID
 *
 * RSQL filters applied (all native headless operators):
 *   summaryLevel == false       → exclude parent/summary taxes
 *   withholdingTax == false     → exclude withholding taxes
 *   salesPurchaseType           → P, S, or skipped (returns all)
 *   taxCategory                 → when provided
 *
 * Response:
 *   [{ id, name, rate, salesPurchaseType, taxCategory, taxCategoryName, validFromDate }]
 *
 * Usage examples:
 *   GET /lite/taxes                          → all non-summary, non-withholding taxes
 *   GET /lite/taxes?type=P                   → purchase taxes only
 *   GET /lite/taxes?type=P&taxCategory=<id>  → purchase taxes for a product's tax category
 */
taxesRouter.get('/', async (req, res, next) => {
  // #swagger.tags = ['Taxes']
  // #swagger.summary = 'Listar impuestos (?type=P|S|B &taxCategory=id)'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)

    const { type, taxCategory } = req.query

    // Build RSQL — only use operators confirmed to work in headless
    const filters = [
      'summaryLevel==false',
      'withholdingTax==false',
    ]

    if (type && ['P', 'S', 'B'].includes(type.toUpperCase())) {
      // B = Both (applies to sales AND purchases)
      // When asking for P or S, also include B
      const t = type.toUpperCase()
      if (t === 'P') filters.push('(salesPurchaseType=="P",salesPurchaseType=="B")')
      else if (t === 'S') filters.push('(salesPurchaseType=="S",salesPurchaseType=="B")')
    }

    if (taxCategory) {
      filters.push(`taxCategory=="${taxCategory}"`)
    }

    const q = filters.join(';')

    const data = await headless.get('TaxRate', q, { _startRow: 0, _endRow: 200 })
    const rows = data?.response?.data ?? []

    const result = rows.map(t => ({
      id:                 t.id,
      name:               t.name,
      rate:               t.rate,
      salesPurchaseType:  t.salesPurchaseType,
      taxCategory:        t.taxCategory,
      taxCategoryName:    t['taxCategory$_identifier'] ?? null,
      validFromDate:      t.validFromDate,
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /lite/taxes/for-product/:productId
 *
 * Resolves the applicable taxes for a given product + transaction type.
 * Reads the product's taxCategory then delegates to the taxes list above.
 *
 * Useful for the UI to auto-populate the tax field when selecting a product.
 *
 * Query params:
 *   type   P | S   (default: P)
 */
taxesRouter.get('/for-product/:productId', async (req, res, next) => {
  // #swagger.tags = ['Taxes']
  // #swagger.summary = 'Impuestos aplicables para un producto (?type=P|S)'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const type     = (req.query.type || 'P').toUpperCase()

    // 1. Get product to read taxCategory
    const prodData = await headless.get('Product', `id=="${req.params.productId}"`, { _startRow: 0, _endRow: 1 })
    const prod = prodData?.response?.data?.[0]
    if (!prod) return res.status(404).json({ error: 'Product not found' })

    const taxCategory = prod.taxCategory
    if (!taxCategory) return res.json([])

    // 2. Get taxes for that category + type
    const filters = [
      'summaryLevel==false',
      'withholdingTax==false',
      `taxCategory=="${taxCategory}"`,
    ]
    if (type === 'P') filters.push('(salesPurchaseType=="P",salesPurchaseType=="B")')
    else if (type === 'S') filters.push('(salesPurchaseType=="S",salesPurchaseType=="B")')

    const taxData = await headless.get('TaxRate', filters.join(';'), { _startRow: 0, _endRow: 100 })
    const rows = taxData?.response?.data ?? []

    const result = rows.map(t => ({
      id:               t.id,
      name:             t.name,
      rate:             t.rate,
      salesPurchaseType: t.salesPurchaseType,
      validFromDate:    t.validFromDate,
    }))

    res.json({
      product:     { id: prod.id, name: prod.name, taxCategory, taxCategoryName: prod['taxCategory$_identifier'] },
      taxes:       result,
    })
  } catch (err) {
    next(err)
  }
})
