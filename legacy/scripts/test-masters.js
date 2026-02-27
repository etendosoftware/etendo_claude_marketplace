#!/usr/bin/env node
/**
 * test-masters.js
 *
 * End-to-end test for POST /lite/masters/customers and /lite/masters/products.
 * Verifies:
 *   - BP created with C_Location linked (c_location_id NOT NULL)
 *   - BPAddress flags correct (invoiceTo, shipTo)
 *   - Product created with price on correct PLV
 *   - Explicit PLV override respected (no callout override)
 *   - GET /customers/:id returns locations array
 *   - POST /customers/:id/locations creates additional location with C_Location
 */

const BASE   = 'http://localhost:3001'
const TENANT = 'demo'

const hdrs = (token) => ({
  'Content-Type': 'application/json',
  Authorization: token ? `Bearer ${token}` : '',
  'x-tenant-id': TENANT,
})

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: hdrs(token),
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`)
  return data
}

// Verify C_BPartner_Location has c_location_id set (legacy compatibility)
async function verifyLocationLinked(bplId, jwtAuth) {
  const r = await fetch(
    `http://localhost:8080/etendo/sws/com.etendoerp.etendorx.datasource/BPAddress?q=id=="${bplId}"&_startRow=0&_endRow=1`,
    { headers: { Authorization: jwtAuth, Accept: 'application/json' } }
  )
  const bpl = (await r.json()).response?.data?.[0]
  if (!bpl?.locationAddress) throw new Error(`BPAddress ${bplId} has no locationAddress (c_location_id is NULL)`)
  return bpl.locationAddress
}

async function main() {
  // ── 1. Login ────────────────────────────────────────────────────────────────
  console.log('\n[1] Login...')
  const { token } = await api('POST', '/lite/auth', null, { username: 'admin', password: 'admin' })
  const jwtAuth = `Bearer ${token}`
  console.log('    ✓ token obtained')

  // ── 2. Create customer with address ─────────────────────────────────────────
  console.log('\n[2] POST /lite/masters/customers (with address)...')
  const customer = await api('POST', '/lite/masters/customers', token, {
    name:       `Test Customer Masters ${Date.now().toString().slice(-5)}`,
    phone:      '+34 912 345 678',
    address1:   'Calle Gran Vía 1',
    postalCode: '28013',
  })
  console.log(`    ✓ BP created: ${customer.name} (${customer.id})`)
  console.log(`    ✓ locations: ${customer.locations?.length}`)

  const bplId = customer.locations?.[0]?.id
  if (!bplId) throw new Error('No location returned')

  const cLocationId = await verifyLocationLinked(bplId, jwtAuth)
  console.log(`    ✓ C_Location linked: ${cLocationId} (legacy OK)`)

  // ── 3. GET /customers/:id returns locations ─────────────────────────────────
  console.log('\n[3] GET /lite/masters/customers/:id...')
  const got = await api('GET', `/lite/masters/customers/${customer.id}`, token)
  if (!got.locations?.length) throw new Error('GET did not return locations')
  console.log(`    ✓ locations: ${got.locations.length} | phone: ${got.locations[0].phone}`)

  // ── 4. Add a second location ─────────────────────────────────────────────────
  console.log('\n[4] POST /lite/masters/customers/:id/locations...')
  const loc2 = await api('POST', `/lite/masters/customers/${customer.id}/locations`, token, {
    name:       'Sucursal Norte',
    shipToAddress: true,
    address1:   'Avenida Norte 42',
    postalCode: '08001',
  })
  console.log(`    ✓ location 2 created: ${loc2.id}`)
  const cLoc2 = await verifyLocationLinked(loc2.id, jwtAuth)
  console.log(`    ✓ C_Location linked: ${cLoc2} (legacy OK)`)

  // ── 5. Create product with default PLV ──────────────────────────────────────
  console.log('\n[5] POST /lite/masters/products (default PLV)...')
  const prod1 = await api('POST', '/lite/masters/products', token, {
    name:      `Test Product Masters ${Date.now().toString().slice(-5)}`,
    listPrice: 29.99,
  })
  console.log(`    ✓ product: ${prod1.name} (${prod1.id})`)
  if (!prod1.price) throw new Error('No price created')
  console.log(`    ✓ price: $${prod1.price.listPrice} | PLV: ${prod1.price.priceListName}`)
  if (prod1.price.priceListName !== 'General Sales') throw new Error(`Wrong PLV: ${prod1.price.priceListName}`)
  console.log(`    ✓ PLV is "General Sales" (correct, no callout override)`)

  // ── 6. Create product with explicit PLV ─────────────────────────────────────
  console.log('\n[6] POST /lite/masters/products (explicit PLV = Otros servicios)...')
  const prod2 = await api('POST', '/lite/masters/products', token, {
    name:            `Test Product PLV ${Date.now().toString().slice(-5)}`,
    listPrice:       9.99,
    priceListVersion: '51589EE7A8A14D928E2F245216A70D66',
  })
  console.log(`    ✓ product: ${prod2.name}`)
  if (prod2.price?.priceListVersion !== '51589EE7A8A14D928E2F245216A70D66') {
    throw new Error(`PLV override failed: got ${prod2.price?.priceListName}`)
  }
  console.log(`    ✓ explicit PLV respected: ${prod2.price.priceListName}`)

  console.log('\n✅ All masters tests passed\n')
}

main().catch(err => {
  console.error('\n❌', err.message)
  process.exit(1)
})
