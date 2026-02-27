/**
 * etendo.js
 * HTTP client for the Etendo/Openbravo API.
 *
 * Two client modes:
 *
 * makeHeadlessClient(etendoUrl, authorization)
 *   Uses EtendoRX headless endpoints:
 *     GET/POST /etendo/sws/com.etendoerp.etendorx.datasource/{endpoint}
 *   - CSRF-free: the headless servlet handles CSRF internally (hardcodes "123")
 *   - Stateless: no session management, no cookie. Just Basic Auth → JWT when ready.
 *   - Recommended for all DataSource operations.
 *
 * makeClient(etendoUrl, authorization)
 *   Uses the classic Etendo DataSource + Kernel APIs.
 *   - Requires session management (JSESSIONID) for FormInitializationComponent.
 *   - Still used for step 5 (document completion via FormInit).
 *   - postJson() kept for fallback / compatibility.
 */

// ── Session cache (used only for FormInit postForm) ──────────────────────────
const sessionCache = new Map()

async function extractJsessionid(headers) {
  const raw = headers.getSetCookie?.() ?? []
  for (const cookie of raw) {
    const m = cookie.match(/JSESSIONID=([^;]+)/)
    if (m) return m[1]
  }
  const setCookie = headers.get('set-cookie') ?? ''
  const m = setCookie.match(/JSESSIONID=([^;]+)/)
  return m ? m[1] : null
}

async function establishSession(etendoUrl, authorization) {
  // Authenticate via Basic Auth — establishes JSESSIONID needed for FormInit.
  const loginRes = await fetch(`${etendoUrl}/etendo/`, {
    method: 'GET',
    headers: { Authorization: authorization },
    redirect: 'follow',
  })

  const jsessionid = await extractJsessionid(loginRes.headers)
  if (!jsessionid) {
    console.warn('[etendo] Could not obtain JSESSIONID — FormInit may fail')
    return { jsessionid: null }
  }
  return { jsessionid }
}

// ── Headless client (preferred for DataSource operations) ────────────────────
export function makeHeadlessClient(etendoUrl, authorization) {
  const baseHeaders = {
    Authorization: authorization,
    Accept: 'application/json',
  }

  const BASE = `${etendoUrl}/etendo/sws/com.etendoerp.etendorx.datasource`

  /**
   * GET (search / fetch)
   * @param {string} endpoint   e.g. 'Customer', 'SalesOrder'
   * @param {string} rsql       RSQL filter string, e.g. "id=='abc123'"
   * @param {Object} params     extra query params (_startRow, _endRow, etc.)
   */
  async function get(endpoint, rsql = '', params = {}) {
    const url = new URL(`${BASE}/${endpoint}`)
    if (rsql) url.searchParams.set('q', rsql)
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })

    const res = await fetch(url.toString(), { headers: baseHeaders })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Headless GET ${endpoint} → ${res.status}: ${body.slice(0, 400)}`)
    }
    return res.json()
  }

  /**
   * POST (create)
   * @param {string} endpoint   e.g. 'SalesOrder'
   * @param {Object} data       flat data fields (no wrapper needed)
   * @param {Object} urlParams  optional URL query params (e.g. callout context like inpcOrderId)
   */
  async function post(endpoint, data, urlParams = {}) {
    const url = new URL(`${BASE}/${endpoint}`)
    Object.entries(urlParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/json', 'Connection': 'close' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Headless POST ${endpoint} → ${res.status}: ${body.slice(0, 400)}`)
    }
    return res.json()
  }

  /**
   * PUT (update)
   * @param {string} endpoint   e.g. 'SalesOrder'
   * @param {Object} data       fields to update (must include id)
   */
  async function put(endpoint, data) {
    const res = await fetch(`${BASE}/${endpoint}`, {
      method: 'PUT',
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Headless PUT ${endpoint} → ${res.status}: ${body.slice(0, 400)}`)
    }
    return res.json()
  }

  return { get, post, put }
}

// ── Classic client (kept for FormInit / kernel actions) ──────────────────────
export function makeClient(etendoUrl, authorization) {
  const cacheKey = `${etendoUrl}::${authorization}`

  const baseHeaders = {
    Authorization: authorization,
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }

  async function getSession() {
    const cached = sessionCache.get(cacheKey)
    if (cached) return cached
    const session = await establishSession(etendoUrl, authorization)
    if (session.jsessionid) sessionCache.set(cacheKey, session)
    return session
  }

  function invalidateSession() {
    sessionCache.delete(cacheKey)
  }

  // ── GET classic datasource (CSRF-free for GETs)
  async function get(path, queryParams = {}) {
    const url = new URL(etendoUrl + path)
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
    const res = await fetch(url.toString(), { headers: baseHeaders })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Etendo GET ${path} → ${res.status}: ${body.slice(0, 400)}`)
    }
    return res.json()
  }

  // ── POST FormInitializationComponent — form-urlencoded, CSRF-free
  //    Only requires a valid JSESSIONID.
  async function postForm(path, formPayload, retry = true) {
    const session = await getSession()
    const { jsessionid } = session ?? {}

    const body = new URLSearchParams(
      Object.fromEntries(
        Object.entries(formPayload).filter(([, v]) => v !== undefined && v !== null)
      )
    ).toString()

    const headers = {
      ...baseHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(jsessionid ? { Cookie: `JSESSIONID=${jsessionid}` } : {}),
    }

    const res = await fetch(etendoUrl + path, {
      method: 'POST',
      headers,
      body,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Etendo FormPost → ${res.status}: ${text.slice(0, 400)}`)
    }
    const data = await res.json()

    if (data?.response?.error?.message === 'InvalidCSRFToken' && retry) {
      invalidateSession()
      return postForm(path, formPayload, false)
    }
    return data
  }

  // ── POST JSON to a classic Etendo endpoint (DataSource saves, etc.)
  //    Sends JSON body with JSESSIONID cookie. Throws if HTTP error or
  //    if the Etendo response.status is non-zero (logical error).
  async function postJson(path, data, queryParams = {}, retry = true) {
    const session = await getSession()
    const { jsessionid } = session ?? {}

    const url = new URL(etendoUrl + path)
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })

    const headers = {
      ...baseHeaders,
      'Content-Type': 'application/json',
      ...(jsessionid ? { Cookie: `JSESSIONID=${jsessionid}` } : {}),
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Etendo JsonPost ${path} → ${res.status}: ${text.slice(0, 400)}`)
    }
    const json = await res.json()

    if (json?.response?.error?.message === 'InvalidCSRFToken' && retry) {
      invalidateSession()
      return postJson(path, data, queryParams, false)
    }
    if (json?.response?.status !== undefined && json.response.status !== 0) {
      throw new Error(`Etendo JsonPost ${path} → status ${json.response.status}: ${JSON.stringify(json.response.error ?? json.response).slice(0, 400)}`)
    }
    return json
  }

  return { get, postForm, postJson }
}
