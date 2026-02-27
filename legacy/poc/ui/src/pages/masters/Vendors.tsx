import { useState, useEffect } from 'react'
import { C, s, b64, AuthProps, authHeader, apiFetch, Spinner, SkeletonRow, PageHeader, ErrorBanner } from '../../styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface Vendor {
  id: string
  name: string
  code: string
  category?: string
}

interface FormState {
  name: string
  searchKey: string
  taxId: string
}

// ── New Vendor Panel ──────────────────────────────────────────────────────────

function NewVendorPanel({
  apiBase, tenantId, username, password, token,
  onCreated, onClose,
}: AuthProps & { onCreated: () => void; onClose: () => void }) {
  const [form, setForm] = useState<FormState>({ name: '', searchKey: '', taxId: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof FormState, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiFetch(`${apiBase}/masters/vendors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader({ token, username, password, apiBase, tenantId }),
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          searchKey: form.searchKey.trim() || undefined,
          taxId: form.taxId.trim() || undefined,
        }),
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
    <div style={{
      ...s.card,
      padding: '24px 28px',
      marginBottom: 20,
      borderColor: C.primary,
      animation: 'dropIn 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.textDark, margin: 0 }}>New Vendor</h3>
        <button
          type="button"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, display: 'flex' }}
          onClick={onClose}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={s.label}>
              Name <span style={{ color: C.danger }}>*</span>
            </label>
            <input
              style={s.input}
              placeholder="Vendor name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
              autoFocus
            />
          </div>
          <div>
            <label style={s.label}>Search Key</label>
            <input
              style={s.input}
              placeholder="Short code (optional)"
              value={form.searchKey}
              onChange={e => set('searchKey', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
          <div>
            <label style={s.label}>Tax ID</label>
            <input
              style={s.input}
              placeholder="Tax identification (optional)"
              value={form.taxId}
              onChange={e => set('taxId', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" style={s.btnSecondary} onClick={onClose}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ ...s.btnPrimary, opacity: submitting ? 0.75 : 1, cursor: submitting ? 'wait' : 'pointer' }}
            disabled={submitting}
            onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
          >
            {submitting ? <><Spinner size={14} color="rgba(255,255,255,0.8)" /> Saving...</> : 'Create Vendor'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Vendors Page ──────────────────────────────────────────────────────────────

export default function Vendors({ apiBase = '/lite', tenantId, username, password, token }: AuthProps) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPanel, setShowPanel] = useState(false)

  function load() {
    setLoading(true)
    const headers = { Authorization: authHeader({ token, username, password, apiBase, tenantId }), 'X-Tenant-ID': tenantId }
    apiFetch(`${apiBase}/masters/vendors`, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setVendors(Array.isArray(d) ? d : []); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [apiBase, tenantId, username, password, token])

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} vendor${vendors.length !== 1 ? 's' : ''} registered`}
        action={
          <button
            style={s.btnPrimary}
            onClick={() => setShowPanel(v => !v)}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Vendor
          </button>
        }
      />

      {showPanel && (
        <NewVendorPanel
          apiBase={apiBase} tenantId={tenantId} username={username} password={password}
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
                <SkeletonRow cols={3} />
              </>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ ...s.td, textAlign: 'center', padding: '48px 16px', color: C.textMuted }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    <span style={{ fontSize: 14 }}>No vendors yet. Create your first one.</span>
                  </div>
                </td>
              </tr>
            ) : (
              vendors.map((v, idx) => (
                <tr
                  key={v.id}
                  style={{ background: idx % 2 === 1 ? C.stripedRow : '#fff' }}
                >
                  <td style={s.td}>
                    <span style={{ fontWeight: 500, color: C.textDark }}>{v.name}</span>
                  </td>
                  <td style={s.td}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 12, fontWeight: 500,
                      background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: 6, padding: '2px 8px', color: C.textMuted,
                    }}>
                      {v.code}
                    </span>
                  </td>
                  <td style={s.td}>
                    {v.category ? (
                      <span style={{
                        background: C.warningBg,
                        color: C.warning,
                        border: `1px solid ${C.warningBorder}`,
                        borderRadius: 6,
                        padding: '3px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {v.category}
                      </span>
                    ) : (
                      <span style={{ color: C.textPlaceholder, fontSize: 13 }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
