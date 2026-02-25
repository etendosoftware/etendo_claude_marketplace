import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// tenants/ lives next to src/
const TENANTS_DIR = path.resolve(__dirname, '../tenants')

const cache = new Map()

export function getTenant(id) {
  if (cache.has(id)) return cache.get(id)
  const file = path.join(TENANTS_DIR, `${id}.json`)
  if (!fs.existsSync(file)) {
    throw new Error(`Tenant '${id}' not found — create tenants/${id}.json`)
  }
  const tenant = JSON.parse(fs.readFileSync(file, 'utf8'))
  cache.set(id, tenant)
  return tenant
}
