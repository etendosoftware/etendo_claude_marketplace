/**
 * swagger.js — Genera docs/swagger_output.json escaneando las rutas.
 *
 * Uso:  node swagger.js
 *       (o automático via npm run docs)
 *
 * swagger-autogen escanea los archivos de rutas buscando:
 *   - app.use() / router.get/post/put/delete()   → paths
 *   - Comentarios JSDoc #swagger.*                → metadata extra
 */

import swaggerAutogen from 'swagger-autogen'
import { readFileSync, writeFileSync } from 'fs'

const doc = {
  info: {
    title: 'Etendo Lite API',
    version: '1.0.0',
    description:
      'Middleware sobre EtendoRX headless. ' +
      'Autenticarse con POST /lite/auth y usar el token como Authorization: Bearer <token>.',
  },
  servers: [{ url: 'http://localhost:3001', description: 'Local dev' }],
  securityDefinitions: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth',      description: 'Login y JWT' },
    { name: 'Masters',   description: 'Clientes, proveedores, productos' },
    { name: 'Taxes',     description: 'Impuestos y tasas' },
    { name: 'Sales',     description: 'Órdenes y facturas de venta' },
    { name: 'Purchases', description: 'Facturas de compra' },
    { name: 'Payables',  description: 'Cuentas a pagar y cobrar' },
  ],
}

const outputFile = './docs/swagger_output.json'
const routes = [
  './src/index.js',
  './src/routes/auth.js',
  './src/routes/masters.js',
  './src/routes/taxes.js',
  './src/routes/sales.js',
  './src/routes/purchases.js',
  './src/routes/payables.js',
]

await swaggerAutogen({ openapi: '3.0.0' })(outputFile, routes, doc)

// Post-process: keep only real Express paths (start with /lite/ or /health or /docs)
const spec = JSON.parse(readFileSync(outputFile, 'utf8'))
// Valid paths: /lite/<module>/<...> — module must be followed by '/'
const validPrefix = /^\/lite\/[a-z]+\//
spec.paths = Object.fromEntries(
  Object.entries(spec.paths).filter(([p]) =>
    (validPrefix.test(p) || p === '/health') && !p.includes('openbravo') && !p.includes('etendo/')
  )
)
writeFileSync(outputFile, JSON.stringify(spec, null, 2))
console.log(`Paths: ${Object.keys(spec.paths).join(', ')}`)
