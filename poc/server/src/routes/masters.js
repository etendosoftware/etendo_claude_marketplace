/**
 * masters.js — Catálogos maestros
 *
 * BusinessPartners (customers / vendors):
 *   GET  /lite/masters/customers                    → lista clientes
 *   GET  /lite/masters/customers/search             → buscar por nombre (?q=)
 *   GET  /lite/masters/customers/:id                → detalle cliente
 *   POST /lite/masters/customers                    → crear cliente completo (BP + location)
 *   PUT  /lite/masters/customers/:id                → actualizar campos financieros
 *   GET  /lite/masters/customers/:id/locations      → listar ubicaciones
 *   POST /lite/masters/customers/:id/locations      → agregar ubicación
 *
 *   GET  /lite/masters/vendors                      → lista proveedores
 *   GET  /lite/masters/vendors/search               → buscar por nombre
 *   GET  /lite/masters/vendors/:id                  → detalle proveedor
 *   POST /lite/masters/vendors                      → crear proveedor completo
 *   PUT  /lite/masters/vendors/:id                  → actualizar campos financieros
 *   GET  /lite/masters/vendors/:id/locations        → listar ubicaciones
 *   POST /lite/masters/vendors/:id/locations        → agregar ubicación
 *
 * Products:
 *   GET  /lite/masters/products                     → lista productos
 *   GET  /lite/masters/products/search              → buscar por nombre
 *   GET  /lite/masters/products/:id                 → detalle + precios
 *   POST /lite/masters/products                     → crear producto + precio
 *   PUT  /lite/masters/products/:id/price           → upsert precio en price list version
 */

import { Router } from 'express'
import { getTenant } from '../tenants.js'
import { makeHeadlessClient } from '../etendo.js'

export const mastersRouter = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function okBP(res) {
  const status = res?.status ?? res?.response?.status
  if (status !== 0) throw new Error(res?.error ?? res?.response?.error ?? `Headless error status ${status}`)
  return res.response?.data?.[0] ?? res.data?.[0]
}

function mapBP(bp) {
  return {
    id:              bp.id,
    name:            bp.name,
    code:            bp.searchKey,
    taxId:           bp.taxID ?? null,
    priceList:       bp.priceList ?? null,
    purchasePricelist: bp.purchasePricelist ?? null,
    paymentTerms:    bp.paymentTerms ?? null,
    paymentMethod:   bp.paymentMethod ?? null,
    creditLimit:     bp.creditLimit ?? 0,
    creditUsed:      bp.creditUsed ?? 0,
    creditStatus:    bp.creditStatus ?? null,
    invoiceTerms:    bp.invoiceTerms ?? null,
    category:        bp['businessPartnerCategory$_identifier'] ?? null,
    customer:        bp.customer ?? false,
    vendor:          bp.vendor ?? false,
  }
}

function mapLocation(loc) {
  return {
    id:               loc.id,
    name:             loc.name,
    phone:            loc.phone ?? null,
    alternativePhone: loc.alternativePhone ?? null,
    invoiceToAddress: loc.invoiceToAddress ?? false,
    shipToAddress:    loc.shipToAddress ?? false,
    payFromAddress:   loc.payFromAddress ?? false,
    remitToAddress:   loc.remitToAddress ?? false,
    locationAddress:  loc.locationAddress ?? null,
  }
}

function mapProduct(p) {
  return {
    id:          p.id,
    name:        p.name,
    code:        p.searchKey,
    uOM:         p.uOM,
    taxCategory: p.taxCategory ?? null,
    productCategory: p.productCategory ?? null,
    sale:        p.sale ?? true,
    purchase:    p.purchase ?? true,
    stocked:     p.stocked ?? false,
  }
}

function mapPrice(pp) {
  return {
    id:               pp.id,
    priceListVersion: pp.priceListVersion,
    priceListName:    pp['priceListVersion$_identifier'] ?? null,
    listPrice:        pp.listPrice ?? 0,
    standardPrice:    pp.standardPrice ?? 0,
    priceLimit:       pp.priceLimit ?? 0,
  }
}

// ── BP shared helpers ─────────────────────────────────────────────────────────

/**
 * Creates a C_Location (physical address) and returns its id.
 * C_Location.c_country_id is NOT NULL — all other fields are optional.
 * This keeps C_BPartner_Location → C_Location relationship complete for legacy compatibility.
 */
async function createLocation(headless, tenant, body) {
  const { address1, address2, postalCode, regionName } = body
  const locRes = await headless.post('Location', {
    organization: tenant.organization,
    country:      body.countryId ?? tenant.defaultCountryId,
    ...(address1    ? { address1 }    : {}),
    ...(address2    ? { address2 }    : {}),
    ...(postalCode  ? { postalCode }  : {}),
    ...(regionName  ? { regionName }  : {}),
  })
  return okBP(locRes)
}

async function createBPWithLocation(headless, tenant, body, isCustomer) {
  const {
    name, searchKey, taxId,
    // financial
    priceList, purchasePricelist, paymentTerms, paymentMethod, creditLimit, invoiceTerms,
    // location
    locationName, phone, alternativePhone,
    invoiceToAddress = true, shipToAddress = true,
  } = body

  // 1. Create base BusinessPartner
  const bpRes = await headless.post('BusinessPartner', {
    organization:            tenant.organization,
    name,
    searchKey:               searchKey ?? name,
    taxID:                   taxId ?? '',
    customer:                isCustomer,
    vendor:                  !isCustomer,
    businessPartnerCategory: isCustomer ? tenant.defaultCustomerBPGroup : tenant.defaultVendorBPGroup,
    language:                tenant.defaultLanguage,
    ...(priceList         ? { priceList }         : {}),
    ...(purchasePricelist ? { purchasePricelist }  : {}),
    ...(paymentTerms      ? { paymentTerms }       : {}),
    ...(paymentMethod     ? { paymentMethod }      : {}),
    ...(creditLimit !== undefined ? { creditLimit } : {}),
    ...(invoiceTerms      ? { invoiceTerms }       : {}),
  })
  const bp = okBP(bpRes)

  // 2. Create C_Location (physical address) — required for legacy compatibility
  const physicalLoc = await createLocation(headless, tenant, body)

  // 3. Create BPAddress linked to the physical location
  const locRes = await headless.post('BPAddress', {
    organization:     tenant.organization,
    businessPartner:  bp.id,
    name:             locationName ?? 'Main',
    locationAddress:  physicalLoc.id,
    invoiceToAddress,
    shipToAddress,
    payFromAddress:   true,
    remitToAddress:   true,
    ...(phone             ? { phone }             : {}),
    ...(alternativePhone  ? { alternativePhone }  : {}),
  })
  const loc = okBP(locRes)

  return { bp, loc }
}

// ── Customers ─────────────────────────────────────────────────────────────────

mastersRouter.get('/customers', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Listar clientes"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { _startRow = 0, _endRow = 50 } = req.query
    const data = await headless.get('BPCustomer', 'customer==true', { _startRow, _endRow })
    res.json((data.response?.data ?? []).map(mapBP))
  } catch (err) { next(err) }
})

mastersRouter.get('/customers/search', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Buscar clientes por nombre (?q=texto)"
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json([])
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const data = await headless.get('BPCustomer', `customer==true;name=ic='${q}'`, { _startRow: 0, _endRow: 20 })
    res.json((data.response?.data ?? []).map(mapBP))
  } catch (err) { next(err) }
})

mastersRouter.get('/customers/:id', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Detalle cliente"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const [bpData, locData] = await Promise.all([
      headless.get('BPCustomer', `id=="${req.params.id}"`, { _startRow: 0, _endRow: 1 }),
      headless.get('BPAddress', `businessPartner=="${req.params.id}"`, { _startRow: 0, _endRow: 50 }),
    ])
    const bp = bpData.response?.data?.[0]
    if (!bp) return res.status(404).json({ error: 'Customer not found' })
    res.json({ ...mapBP(bp), locations: (locData.response?.data ?? []).map(mapLocation) })
  } catch (err) { next(err) }
})

mastersRouter.post('/customers', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Crear cliente (BP + location + campos financieros opcionales)"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { bp, loc } = await createBPWithLocation(headless, tenant, req.body, true)
    res.status(201).json({ ...mapBP(bp), locations: [mapLocation(loc)] })
  } catch (err) { next(err) }
})

mastersRouter.put('/customers/:id', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Actualizar campos financieros del cliente"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { priceList, paymentTerms, paymentMethod, creditLimit, invoiceTerms } = req.body
    const upd = {}
    if (priceList     !== undefined) upd.priceList     = priceList
    if (paymentTerms  !== undefined) upd.paymentTerms  = paymentTerms
    if (paymentMethod !== undefined) upd.paymentMethod = paymentMethod
    if (creditLimit   !== undefined) upd.creditLimit   = creditLimit
    if (invoiceTerms  !== undefined) upd.invoiceTerms  = invoiceTerms
    const updRes = await headless.post('BPCustomer', { id: req.params.id, ...upd })
    const bp = okBP(updRes)
    res.json(mapBP(bp))
  } catch (err) { next(err) }
})

mastersRouter.get('/customers/:id/locations', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Listar ubicaciones del cliente"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const data = await headless.get('BPAddress', `businessPartner=="${req.params.id}"`, { _startRow: 0, _endRow: 50 })
    res.json((data.response?.data ?? []).map(mapLocation))
  } catch (err) { next(err) }
})

mastersRouter.post('/customers/:id/locations', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Agregar ubicación al cliente"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const {
      name = 'Address', phone, alternativePhone,
      invoiceToAddress = false, shipToAddress = false,
      payFromAddress = false, remitToAddress = false,
    } = req.body
    const physicalLoc = await createLocation(headless, tenant, req.body)
    const locRes = await headless.post('BPAddress', {
      organization:    tenant.organization,
      businessPartner: req.params.id,
      name,
      locationAddress: physicalLoc.id,
      invoiceToAddress,
      shipToAddress,
      payFromAddress,
      remitToAddress,
      ...(phone            ? { phone }            : {}),
      ...(alternativePhone ? { alternativePhone } : {}),
    })
    const loc = okBP(locRes)
    res.status(201).json(mapLocation(loc))
  } catch (err) { next(err) }
})

mastersRouter.put('/customers/:id/locations/:locationId', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Actualizar ubicación del cliente"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { name, phone, alternativePhone, invoiceToAddress, shipToAddress, payFromAddress, remitToAddress } = req.body
    const upd = { id: req.params.locationId }
    if (name !== undefined)             upd.name             = name
    if (phone !== undefined)            upd.phone            = phone
    if (alternativePhone !== undefined) upd.alternativePhone = alternativePhone
    if (invoiceToAddress !== undefined) upd.invoiceToAddress = invoiceToAddress
    if (shipToAddress !== undefined)    upd.shipToAddress    = shipToAddress
    if (payFromAddress !== undefined)   upd.payFromAddress   = payFromAddress
    if (remitToAddress !== undefined)   upd.remitToAddress   = remitToAddress
    const locRes = await headless.post('BPAddress', upd)
    const loc = okBP(locRes)
    res.json(mapLocation(loc))
  } catch (err) { next(err) }
})

mastersRouter.delete('/customers/:id/locations/:locationId', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Eliminar ubicación del cliente (soft delete)"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    await headless.post('BPAddress', { id: req.params.locationId, active: false })
    res.status(204).end()
  } catch (err) { next(err) }
})

// ── Vendors ───────────────────────────────────────────────────────────────────

mastersRouter.get('/vendors', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Listar proveedores"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { _startRow = 0, _endRow = 50 } = req.query
    const data = await headless.get('BPVendor', 'vendor==true', { _startRow, _endRow })
    res.json((data.response?.data ?? []).map(mapBP))
  } catch (err) { next(err) }
})

mastersRouter.get('/vendors/search', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Buscar proveedores por nombre"
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json([])
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const data = await headless.get('BPVendor', `vendor==true;name=ic='${q}'`, { _startRow: 0, _endRow: 20 })
    res.json((data.response?.data ?? []).map(mapBP))
  } catch (err) { next(err) }
})

mastersRouter.get('/vendors/:id', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Detalle proveedor"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const [bpData, locData] = await Promise.all([
      headless.get('BPVendor', `id=="${req.params.id}"`, { _startRow: 0, _endRow: 1 }),
      headless.get('BPAddress', `businessPartner=="${req.params.id}"`, { _startRow: 0, _endRow: 50 }),
    ])
    const bp = bpData.response?.data?.[0]
    if (!bp) return res.status(404).json({ error: 'Vendor not found' })
    res.json({ ...mapBP(bp), locations: (locData.response?.data ?? []).map(mapLocation) })
  } catch (err) { next(err) }
})

mastersRouter.post('/vendors', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Crear proveedor (BP + location + campos financieros opcionales)"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { bp, loc } = await createBPWithLocation(headless, tenant, req.body, false)
    res.status(201).json({ ...mapBP(bp), locations: [mapLocation(loc)] })
  } catch (err) { next(err) }
})

mastersRouter.put('/vendors/:id', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Actualizar campos financieros del proveedor"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { purchasePricelist, paymentTerms, paymentMethod, creditLimit, invoiceTerms } = req.body
    const upd = {}
    if (purchasePricelist !== undefined) upd.purchasePricelist = purchasePricelist
    if (paymentTerms     !== undefined) upd.paymentTerms     = paymentTerms
    if (paymentMethod    !== undefined) upd.paymentMethod    = paymentMethod
    if (creditLimit      !== undefined) upd.creditLimit      = creditLimit
    if (invoiceTerms     !== undefined) upd.invoiceTerms     = invoiceTerms
    const updRes = await headless.post('BPVendor', { id: req.params.id, ...upd })
    const bp = okBP(updRes)
    res.json(mapBP(bp))
  } catch (err) { next(err) }
})

mastersRouter.get('/vendors/:id/locations', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Listar ubicaciones del proveedor"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const data = await headless.get('BPAddress', `businessPartner=="${req.params.id}"`, { _startRow: 0, _endRow: 50 })
    res.json((data.response?.data ?? []).map(mapLocation))
  } catch (err) { next(err) }
})

mastersRouter.post('/vendors/:id/locations', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Agregar ubicación al proveedor"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const {
      name = 'Address', phone, alternativePhone,
      invoiceToAddress = false, shipToAddress = false,
      payFromAddress = false, remitToAddress = false,
    } = req.body
    const physicalLoc = await createLocation(headless, tenant, req.body)
    const locRes = await headless.post('BPAddress', {
      organization:    tenant.organization,
      businessPartner: req.params.id,
      name,
      locationAddress: physicalLoc.id,
      invoiceToAddress,
      shipToAddress,
      payFromAddress,
      remitToAddress,
      ...(phone            ? { phone }            : {}),
      ...(alternativePhone ? { alternativePhone } : {}),
    })
    const loc = okBP(locRes)
    res.status(201).json(mapLocation(loc))
  } catch (err) { next(err) }
})

mastersRouter.put('/vendors/:id/locations/:locationId', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Actualizar ubicación del proveedor"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { name, phone, alternativePhone, invoiceToAddress, shipToAddress, payFromAddress, remitToAddress } = req.body
    const upd = { id: req.params.locationId }
    if (name !== undefined)             upd.name             = name
    if (phone !== undefined)            upd.phone            = phone
    if (alternativePhone !== undefined) upd.alternativePhone = alternativePhone
    if (invoiceToAddress !== undefined) upd.invoiceToAddress = invoiceToAddress
    if (shipToAddress !== undefined)    upd.shipToAddress    = shipToAddress
    if (payFromAddress !== undefined)   upd.payFromAddress   = payFromAddress
    if (remitToAddress !== undefined)   upd.remitToAddress   = remitToAddress
    const locRes = await headless.post('BPAddress', upd)
    const loc = okBP(locRes)
    res.json(mapLocation(loc))
  } catch (err) { next(err) }
})

mastersRouter.delete('/vendors/:id/locations/:locationId', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Eliminar ubicación del proveedor (soft delete)"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    await headless.post('BPAddress', { id: req.params.locationId, active: false })
    res.status(204).end()
  } catch (err) { next(err) }
})

// ── Products ──────────────────────────────────────────────────────────────────

mastersRouter.get('/products', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Listar productos (con unitPrice del price list version por defecto)"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { _startRow = 0, _endRow = 100, priceListVersionId } = req.query

    const plvId = priceListVersionId ?? tenant.defaultPriceListVersionId

    // Fetch products + prices in parallel
    const [prodData, priceData] = await Promise.all([
      headless.get('Product', '', { _startRow, _endRow }),
      plvId
        ? headless.get('ProductPrice', `priceListVersion=="${plvId}"`, { _startRow: 0, _endRow: 500 })
        : Promise.resolve({ response: { data: [] } }),
    ])

    const priceByProduct = Object.fromEntries(
      (priceData.response?.data ?? []).map(pp => [pp.product, pp.listPrice ?? 0])
    )

    res.json((prodData.response?.data ?? []).map(p => ({
      ...mapProduct(p),
      unitPrice: priceByProduct[p.id] ?? 0,
    })))
  } catch (err) { next(err) }
})

mastersRouter.get('/products/search', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Buscar productos por nombre"
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json([])
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const data = await headless.get('Product', `name=ic='${q}'`, { _startRow: 0, _endRow: 20 })
    res.json((data.response?.data ?? []).map(mapProduct))
  } catch (err) { next(err) }
})

mastersRouter.get('/products/:id', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Detalle producto + precios"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const [prodData, priceData] = await Promise.all([
      headless.get('Product', `id=="${req.params.id}"`, { _startRow: 0, _endRow: 1 }),
      headless.get('ProductPrice', `product=="${req.params.id}"`, { _startRow: 0, _endRow: 20 }),
    ])
    const p = prodData.response?.data?.[0]
    if (!p) return res.status(404).json({ error: 'Product not found' })
    res.json({ ...mapProduct(p), prices: (priceData.response?.data ?? []).map(mapPrice) })
  } catch (err) { next(err) }
})

mastersRouter.post('/products', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Crear producto + precio opcional"
  // #swagger.description = "Si se pasa priceListVersion + listPrice, se crea el precio automáticamente"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const {
      name, searchKey, uOM, taxCategory, productCategory,
      sale = true, purchase = true, stocked = false,
      // price (optional)
      priceListVersion, listPrice, standardPrice, priceLimit = 0,
    } = req.body

    // 1. Create product
    const pRes = await headless.post('Product', {
      organization: tenant.organization,
      name,
      searchKey:    searchKey ?? name,
      uOM:          uOM ?? '100',
      sale,
      purchase,
      stocked,
      ...(taxCategory     ? { taxCategory }     : {}),
      ...(productCategory ? { productCategory } : {}),
    })
    const p = okBP(pRes)

    // 2. Create price if priceListVersion + listPrice provided
    let price = null
    const plv = priceListVersion ?? tenant.defaultPriceListVersionId
    if (plv && listPrice !== undefined) {
      const ppRes = await headless.post('ProductPrice', {
        organization:     tenant.organization,
        priceListVersion: plv,
        product:          p.id,
        listPrice,
        standardPrice:    standardPrice ?? listPrice,
        priceLimit,
      })
      price = mapPrice(okBP(ppRes))
    }

    res.status(201).json({ ...mapProduct(p), price })
  } catch (err) { next(err) }
})

mastersRouter.get('/pricelists', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Listar price list versions activas"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const data = await headless.get('PriceListVersion', 'active==true', { _startRow: 0, _endRow: 100 })
    const rows = data.response?.data ?? []
    res.json(rows.map(plv => ({
      id:   plv.id,
      name: plv['priceList$name'] ? `${plv['priceList$name']} — ${plv.name}` : plv.name,
    })))
  } catch (err) { next(err) }
})

mastersRouter.put('/products/:id/price', async (req, res, next) => {
  // #swagger.tags = ["Masters"]
  // #swagger.summary = "Crear o actualizar precio de producto en una price list version"
  try {
    const tenant   = getTenant(req.tenantId)
    const headless = makeHeadlessClient(tenant.etendoUrl, req.etendoAuth)
    const { listPrice, standardPrice, priceLimit = 0 } = req.body
    const plv = req.body.priceListVersion ?? tenant.defaultPriceListVersionId
    if (!plv) return res.status(400).json({ error: 'priceListVersion required (or set defaultPriceListVersionId in tenant)' })

    // Check if price already exists for this product+version
    const existing = await headless.get(
      'ProductPrice',
      `product=="${req.params.id}";priceListVersion=="${plv}"`,
      { _startRow: 0, _endRow: 1 }
    )
    const existingRecord = existing.response?.data?.[0]

    const ppRes = await headless.post('ProductPrice', {
      ...(existingRecord ? { id: existingRecord.id } : {}),
      organization:     tenant.organization,
      priceListVersion: plv,
      product:          req.params.id,
      listPrice,
      standardPrice:    standardPrice ?? listPrice,
      priceLimit,
    })
    const pp = okBP(ppRes)
    res.json(mapPrice(pp))
  } catch (err) { next(err) }
})
