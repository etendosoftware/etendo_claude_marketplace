import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, s, formatCurrency, AuthProps, authHeader, apiFetch, SkeletonRow, PageHeader, ErrorBanner, StatusBadge } from '../../styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface PurchaseInvoice {
  id: string
  documentNo: string
  vendor: string
  vendorId: string
  grandTotal: number
  currency: string
  invoiceDate: string
  status: string
}

// ── Purchase Invoices Page ────────────────────────────────────────────────────

export default function PurchaseInvoices({ apiBase = '/lite', tenantId, username, password, token }: AuthProps) {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const headers = { Authorization: authHeader({ token, username, password, apiBase, tenantId }), 'X-Tenant-ID': tenantId }
    setLoading(true)
    apiFetch(`${apiBase}/purchases/invoices`, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setInvoices(d.data ?? (Array.isArray(d) ? d : [])); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, tenantId, username, password, token])

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      <PageHeader
        title="Purchase Invoices"
        subtitle={loading ? '' : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
        action={
          <button
            style={s.btnPrimary}
            onClick={() => navigate('/purchases/new')}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Invoice
          </button>
        }
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div style={{ ...s.card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={s.th}>Document No.</th>
              <th style={s.th}>Date</th>
              <th style={s.th}>Vendor</th>
              <th style={s.th}>Status</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow cols={5} />
                <SkeletonRow cols={5} />
                <SkeletonRow cols={5} />
                <SkeletonRow cols={5} />
                <SkeletonRow cols={5} />
              </>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...s.td, textAlign: 'center', padding: '48px 16px', color: C.textMuted }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 01-8 0" />
                    </svg>
                    <span style={{ fontSize: 14 }}>No purchase invoices found.</span>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((inv, idx) => (
                <tr key={inv.id} style={{ background: idx % 2 === 1 ? C.stripedRow : '#fff' }}>
                  <td style={s.td}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.primary }}>
                      {inv.documentNo}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize: 13, color: C.textBody }}>{formatDate(inv.invoiceDate)}</span>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 500, color: C.textDark }}>{inv.vendor ?? inv.vendorId}</span>
                  </td>
                  <td style={s.td}>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: C.textDark, fontSize: 14 }}>
                      {formatCurrency(inv.grandTotal ?? 0, inv.currency || 'USD')}
                    </span>
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
