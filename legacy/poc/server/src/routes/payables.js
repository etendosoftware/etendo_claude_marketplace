/**
 * payables.js — Cobros y pagos pendientes
 *
 * GET /lite/payables/receivables  → facturas de venta pendientes de cobro
 * GET /lite/payables/payables     → facturas de compra pendientes de pago
 * GET /lite/payables/summary      → resumen: total a cobrar / total a pagar
 *
 * Nota: SalesInvoice headless endpoint puede estar roto si ADField fue eliminado
 * del servidor. En ese caso receivables devuelve { available: false, reason }.
 *
 * "Pendiente" en Etendo = documentStatus == "CO" (Completed, sin pagar).
 * También incluimos DR (Draft) para visibilidad de borradores.
 */

import { Router } from 'express'
import { getTenant } from '../tenants.js'
import { makeHeadlessClient } from '../etendo.js'

export const payablesRouter = Router()

function mapInvoice(inv, type) {
  return {
    id:          inv.id,
    documentNo:  inv.documentNo,
    date:        inv.invoiceDate,
    partner:     inv['businessPartner$_identifier'],
    partnerId:   inv.businessPartner,
    status:      inv.documentStatus,
    grandTotal:  inv.grandTotalAmount,
    currency:    inv['currency$_identifier'],
    type,
  }
}

// ── GET /lite/payables/payables  (facturas de compra pendientes) ──────────────

payablesRouter.get('/payables', async (req, res, next) => {
  // #swagger.tags = ['Payables']
  // #swagger.summary = 'Facturas de compra pendientes de pago (CO + DR)'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { _startRow = 0, _endRow = 100 } = req.query

    // CO = completada (pendiente de pago), DR = borrador
    const data = await headless.get(
      'PurchaseInvoice',
      '(documentStatus=="CO",documentStatus=="DR")',
      { _startRow, _endRow }
    )

    const rows = (data.response?.data ?? []).map(inv => mapInvoice(inv, 'purchase'))
    res.json({ total: data.response?.totalRows ?? rows.length, data: rows })
  } catch (err) {
    next(err)
  }
})

// ── GET /lite/payables/receivables  (facturas de venta pendientes) ───────────

payablesRouter.get('/receivables', async (req, res, next) => {
  // #swagger.tags = ['Payables']
  // #swagger.summary = 'Facturas de venta pendientes de cobro (CO + DR)'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { _startRow = 0, _endRow = 100 } = req.query

    const data = await headless.get(
      'SalesInvoice',
      '(documentStatus=="CO",documentStatus=="DR")',
      { _startRow, _endRow }
    )

    const rows = (data.response?.data ?? []).map(inv => mapInvoice(inv, 'sales'))
    res.json({ total: data.response?.totalRows ?? rows.length, data: rows })
  } catch (err) {
    // SalesInvoice headless may be misconfigured (deleted ADField).
    // Return a structured unavailable response instead of 500.
    const msg = err.message ?? ''
    if (msg.includes('ADField') || msg.includes('No row with the given identifier')) {
      return res.json({ available: false, reason: 'SalesInvoice not configured on this server', data: [] })
    }
    next(err)
  }
})

// ── GET /lite/payables/summary ────────────────────────────────────────────────

payablesRouter.get('/summary', async (req, res, next) => {
  // #swagger.tags = ['Payables']
  // #swagger.summary = 'Resumen total a pagar / total a cobrar'
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)

    // Fetch purchase and sales invoices in parallel.
    // SalesInvoice may be unavailable (broken ADField config) — handle gracefully.
    const [purchaseData, salesData] = await Promise.all([
      headless.get('PurchaseInvoice', 'documentStatus=="CO"', { _startRow: 0, _endRow: 200 }),
      headless.get('SalesInvoice', 'documentStatus=="CO"', { _startRow: 0, _endRow: 200 })
        .catch(err => ({ _error: err.message })),
    ])

    const purchases = purchaseData.response?.data ?? []
    const totalPayable = purchases.reduce((sum, inv) => sum + (inv.grandTotalAmount ?? 0), 0)

    let receivable
    if (salesData._error) {
      receivable = { available: false, reason: 'SalesInvoice not configured on this server' }
    } else {
      const sales = salesData.response?.data ?? []
      const totalReceivable = sales.reduce((sum, inv) => sum + (inv.grandTotalAmount ?? 0), 0)
      receivable = {
        available: true,
        count:    sales.length,
        total:    Math.round(totalReceivable * 100) / 100,
        currency: sales[0]?.['currency$_identifier'] ?? null,
      }
    }

    res.json({
      payable: {
        count:    purchases.length,
        total:    Math.round(totalPayable * 100) / 100,
        currency: purchases[0]?.['currency$_identifier'] ?? null,
      },
      receivable,
    })
  } catch (err) {
    next(err)
  }
})
