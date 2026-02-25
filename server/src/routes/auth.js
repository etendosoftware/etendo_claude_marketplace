import { Router } from 'express'
import { getTenant } from '../tenants.js'

export const authRouter = Router()

/**
 * POST /lite/auth
 *
 * Exchanges credentials for a JWT Bearer token via Etendo SWS login.
 * The UI stores this token and sends it as Authorization: Bearer <token>
 * in all subsequent requests. The middleware passes it through directly.
 *
 * Body: { username, password }
 *
 * Response: { token, roleList }
 *   token     → use as "Bearer <token>" in Authorization header
 *   roleList  → available roles for this user (id, name, orgList)
 */
authRouter.post('/', async (req, res, next) => {
  // #swagger.tags = ['Auth']
  // #swagger.summary = 'Obtener JWT — Body: { username, password }'
  // #swagger.security = []
  try {
    const tenant = getTenant(req.tenantId)
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' })
    }

    const etendoRes = await fetch(`${tenant.etendoUrl}/etendo/sws/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, role: tenant.swsLoginRole, organization: tenant.organization }),
    })

    const data = await etendoRes.json()

    if (data.status !== 'success') {
      return res.status(401).json({ error: data.message ?? 'Login failed' })
    }

    res.json({ token: data.token, roleList: data.roleList })
  } catch (err) {
    next(err)
  }
})
