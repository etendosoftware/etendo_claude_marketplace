import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import { createRequire } from 'module'
import { authRouter } from './routes/auth.js'
import { salesRouter } from './routes/sales.js'
import { purchasesRouter } from './routes/purchases.js'
import { mastersRouter } from './routes/masters.js'
import { taxesRouter } from './routes/taxes.js'
import { payablesRouter } from './routes/payables.js'

const require = createRequire(import.meta.url)
let swaggerSpec = {}
try { swaggerSpec = require('../docs/swagger_output.json') } catch { /* run npm run docs first */ }

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

// Attach tenant + auth to every request
app.use((req, _res, next) => {
  req.tenantId = req.headers['x-tenant-id'] || 'demo'
  req.etendoAuth = req.headers['authorization'] || ''
  next()
})

app.get('/docs/spec.json', (_req, res) => res.json(swaggerSpec))
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/lite/auth', authRouter)
app.use('/lite/sales', salesRouter)
app.use('/lite/purchases', purchasesRouter)
app.use('/lite/masters', mastersRouter)
app.use('/lite/taxes', taxesRouter)
app.use('/lite/payables', payablesRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use((err, _req, res, _next) => {
  console.error(err.message)
  res.status(500).json({ error: err.message })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Etendo Lite server :${PORT}`))
