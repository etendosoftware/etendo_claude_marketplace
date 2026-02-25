import { useState, useEffect } from 'react'
import { C, s, AuthProps, authHeader, apiFetch, Spinner, SkeletonRow, PageHeader, ErrorBanner } from '../../styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
  code: string
  category?: string
}

interface Location {
  id: string
  name: string
  phone?: string
  invoiceToAddress: boolean
  shipToAddress: boolean
  locationAddress?: string
}

// ── New Customer Panel ────────────────────────────────────────────────────────

function NewCustomerPanel({
  apiBase, tenantId, token,
  onCreated, onClose,
}: Pick<AuthProps, 'apiBase' | 'tenantId' | 'token'> & { onCreated: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', searchKey: '', taxId: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiFetch(`${apiBase}/masters/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
        body: JSON.stringify({ name: form.name.trim(), searchKey: form.searchKey.trim() || undefined, taxId: form.taxId.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ ...s.card, padding: '24px 28px', marginBottom: 20, borderColor: C.primary, animation: 'dropIn 0.2s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.textDark, margin: 0 }}>New Customer</h3>
        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, display: 'flex' }} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={s.label}>Name <span style={{ color: C.danger }}>*</span></label>
            <input style={s.input} placeholder="Customer name" value={form.name} onChange={e => set('name', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }} autoFocus />
          </div>
          <div>
            <label style={s.label}>Search Key</label>
            <input style={s.input} placeholder="Short code (optional)" value={form.searchKey} onChange={e => set('searchKey', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }} />
          </div>
          <div>
            <label style={s.label}>Tax ID</label>
            <input style={s.input} placeholder="Tax identification (optional)" value={form.taxId} onChange={e => set('taxId', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={s.btnSecondary} onClick={onClose}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}>Cancel</button>
          <button type="submit" style={{ ...s.btnPrimary, opacity: submitting ? 0.75 : 1, cursor: submitting ? 'wait' : 'pointer' }} disabled={submitting}
            onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}>
            {submitting ? <><Spinner size={14} color="rgba(255,255,255,0.8)" /> Saving...</> : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Location Form (Add or Edit) ───────────────────────────────────────────────

function LocationForm({
  apiBase, tenantId, token, customerId,
  location, onSaved, onClose,
}: Pick<AuthProps, 'apiBase' | 'tenantId' | 'token'> & {
  customerId: string
  location?: Location   // if provided → edit mode
  onSaved: () => void
  onClose: () => void
}) {
  const isEdit = !!location
  const [form, setForm] = useState({
    name: location?.name ?? 'Main',
    address1: '',
    postalCode: '',
    phone: location?.phone ?? '',
    invoiceToAddress: location?.invoiceToAddress ?? true,
    shipToAddress: location?.shipToAddress ?? true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, val: string | boolean) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const url = isEdit
        ? `${apiBase}/masters/customers/${customerId}/locations/${location!.id}`
        : `${apiBase}/masters/customers/${customerId}/locations`
      const method = isEdit ? 'PUT' : 'POST'
      const body: Record<string, unknown> = {
        name: form.name.trim() || 'Main',
        phone: form.phone.trim() || undefined,
        invoiceToAddress: form.invoiceToAddress,
        shipToAddress: form.shipToAddress,
        payFromAddress: true,
        remitToAddress: true,
      }
      if (!isEdit) {
        body.address1   = form.address1.trim() || undefined
        body.postalCode = form.postalCode.trim() || undefined
      }
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const checkStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.textBody }

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 20px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{isEdit ? 'Edit Location' : 'Add Location'}</span>
        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2, display: 'flex' }} onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={s.label}>Location Name</label>
            <input style={s.input} placeholder="Main, Billing, etc." value={form.name} onChange={e => set('name', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }} autoFocus />
          </div>
          <div>
            <label style={s.label}>Phone</label>
            <input style={s.input} placeholder="+1 555 000 0000" value={form.phone} onChange={e => set('phone', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }} />
          </div>
          {!isEdit && (
            <>
              <div>
                <label style={s.label}>Address</label>
                <input style={s.input} placeholder="Street address" value={form.address1} onChange={e => set('address1', e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }} />
              </div>
              <div>
                <label style={s.label}>Postal Code</label>
                <input style={s.input} placeholder="ZIP / Postal code" value={form.postalCode} onChange={e => set('postalCode', e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }} />
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
          <label style={checkStyle}>
            <input type="checkbox" checked={form.invoiceToAddress} onChange={e => set('invoiceToAddress', e.target.checked)} />
            Invoice to
          </label>
          <label style={checkStyle}>
            <input type="checkbox" checked={form.shipToAddress} onChange={e => set('shipToAddress', e.target.checked)} />
            Ship to
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={{ ...s.btnSecondary, padding: '7px 14px', fontSize: 12 }} onClick={onClose}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}>Cancel</button>
          <button type="submit" style={{ ...s.btnPrimary, padding: '7px 14px', fontSize: 12, opacity: submitting ? 0.75 : 1 }} disabled={submitting}
            onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}>
            {submitting ? <><Spinner size={12} color="rgba(255,255,255,0.8)" /> Saving...</> : (isEdit ? 'Save Changes' : 'Add Location')}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Customer Detail Drawer ────────────────────────────────────────────────────

function CustomerDetail({
  apiBase, tenantId, token, customer, onClose,
}: Pick<AuthProps, 'apiBase' | 'tenantId' | 'token'> & { customer: Customer; onClose: () => void }) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  function loadLocations() {
    setLoading(true)
    apiFetch(`${apiBase}/masters/customers/${customer.id}/locations`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
    })
      .then(r => r.json())
      .then(d => { setLocations(Array.isArray(d) ? d : []); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadLocations() }, [customer.id])

  async function handleDelete(locationId: string) {
    setDeleting(locationId)
    try {
      const res = await apiFetch(`${apiBase}/masters/customers/${customer.id}/locations/${locationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      setConfirmDeleteId(null)
      loadLocations()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(null)
    }
  }

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
    transition: 'background 0.1s, color 0.1s',
    color: C.textMuted,
  }

  return (
    <tr>
      <td colSpan={4} style={{ padding: 0, background: C.bg }}>
        <div style={{ padding: '16px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.primary }}>
                {customer.name[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: C.textDark, fontSize: 14 }}>{customer.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>{customer.code}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!showForm && !editingId && (
                <button
                  style={{ ...s.btnSecondary, padding: '6px 12px', fontSize: 12 }}
                  onClick={() => setShowForm(true)}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                >
                  + Add Location
                </button>
              )}
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, display: 'flex' }} onClick={onClose}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
              </button>
            </div>
          </div>

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {/* Locations list */}
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Locations
          </div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted, fontSize: 13 }}>
              <Spinner size={14} color={C.textMuted} /> Loading...
            </div>
          ) : locations.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 13, fontStyle: 'italic' }}>No locations yet.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {locations.map(loc => (
                <div key={loc.id}>
                  {editingId === loc.id ? (
                    <LocationForm
                      apiBase={apiBase} tenantId={tenantId} token={token}
                      customerId={customer.id}
                      location={loc}
                      onSaved={() => { setEditingId(null); loadLocations() }}
                      onClose={() => setEditingId(null)}
                    />
                  ) : confirmDeleteId === loc.id ? (
                    <div style={{
                      background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, borderRadius: 8,
                      padding: '10px 14px', fontSize: 13, minWidth: 200,
                    }}>
                      <div style={{ fontWeight: 600, color: C.danger, marginBottom: 6 }}>Delete "{loc.name}"?</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={{ ...s.btnSecondary, padding: '4px 10px', fontSize: 12 }}
                          onClick={() => setConfirmDeleteId(null)}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                        >Cancel</button>
                        <button
                          onClick={() => handleDelete(loc.id)}
                          disabled={deleting === loc.id}
                          style={{
                            background: C.danger, color: '#fff', border: 'none', borderRadius: 6,
                            padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: deleting === loc.id ? 'wait' : 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
                            opacity: deleting === loc.id ? 0.75 : 1,
                          }}
                        >
                          {deleting === loc.id ? <Spinner size={11} color="rgba(255,255,255,0.8)" /> : null}
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '10px 14px', fontSize: 13, minWidth: 160,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, color: C.textDark }}>{loc.name}</div>
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button
                            style={iconBtn}
                            title="Edit"
                            onClick={() => { setEditingId(loc.id); setShowForm(false) }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primaryLight; (e.currentTarget as HTMLButtonElement).style.color = C.primary }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = C.textMuted }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            style={iconBtn}
                            title="Delete"
                            onClick={() => setConfirmDeleteId(loc.id)}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.dangerBg; (e.currentTarget as HTMLButtonElement).style.color = C.danger }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = C.textMuted }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {loc.phone && <div style={{ color: C.textMuted, fontSize: 12 }}>{loc.phone}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {loc.invoiceToAddress && <span style={{ fontSize: 10, fontWeight: 600, background: C.primaryLight, color: C.primary, borderRadius: 4, padding: '2px 6px' }}>Invoice</span>}
                        {loc.shipToAddress && <span style={{ fontSize: 10, fontWeight: 600, background: C.successBg, color: C.success, borderRadius: 4, padding: '2px 6px' }}>Ship</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showForm && (
            <LocationForm
              apiBase={apiBase} tenantId={tenantId} token={token}
              customerId={customer.id}
              onSaved={() => { setShowForm(false); loadLocations() }}
              onClose={() => setShowForm(false)}
            />
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Customers Page ────────────────────────────────────────────────────────────

export default function Customers({ apiBase = '/lite', tenantId, token }: AuthProps) {
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showPanel, setShowPanel]   = useState(false)
  const [expanded, setExpanded]     = useState<string | null>(null)

  function load() {
    setLoading(true)
    apiFetch(`${apiBase}/masters/customers`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setCustomers(Array.isArray(d) ? d : []); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [apiBase, tenantId, token])

  function toggleExpanded(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length !== 1 ? 's' : ''} registered`}
        action={
          <button style={s.btnPrimary} onClick={() => setShowPanel(v => !v)}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Customer
          </button>
        }
      />

      {showPanel && (
        <NewCustomerPanel
          apiBase={apiBase} tenantId={tenantId} token={token}
          onCreated={() => { setShowPanel(false); load() }}
          onClose={() => setShowPanel(false)}
        />
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div style={{ ...s.card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={s.th}>Name</th>
              <th style={s.th}>Code</th>
              <th style={s.th}>Category</th>
              <th style={{ ...s.th, width: 80, textAlign: 'center' }}>Locations</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
              </>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...s.td, textAlign: 'center', padding: '48px 16px', color: C.textMuted }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    <span style={{ fontSize: 14 }}>No customers yet. Create your first one.</span>
                  </div>
                </td>
              </tr>
            ) : (
              customers.flatMap((c, idx) => {
                const isOpen = expanded === c.id
                const rows = [
                  <tr
                    key={c.id}
                    onClick={() => toggleExpanded(c.id)}
                    style={{ background: isOpen ? C.primaryLight : idx % 2 === 1 ? C.stripedRow : '#fff', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isOpen) (e.currentTarget as HTMLTableRowElement).style.background = C.bg }}
                    onMouseLeave={e => { if (!isOpen) (e.currentTarget as HTMLTableRowElement).style.background = idx % 2 === 1 ? C.stripedRow : '#fff' }}
                  >
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span style={{ fontWeight: 500, color: C.textDark }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px', color: C.textMuted }}>
                        {c.code}
                      </span>
                    </td>
                    <td style={s.td}>
                      {c.category ? (
                        <span style={{ background: C.primaryLight, color: C.primary, border: `1px solid rgba(79,70,229,0.2)`, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                          {c.category}
                        </span>
                      ) : <span style={{ color: C.textPlaceholder, fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); toggleExpanded(c.id) }}
                        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', color: C.primary, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primaryLight }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                      >
                        {isOpen ? 'Close' : 'Manage'}
                      </button>
                    </td>
                  </tr>,
                ]
                if (isOpen) {
                  rows.push(
                    <CustomerDetail
                      key={`${c.id}-detail`}
                      apiBase={apiBase} tenantId={tenantId} token={token}
                      customer={c}
                      onClose={() => setExpanded(null)}
                    />
                  )
                }
                return rows
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
