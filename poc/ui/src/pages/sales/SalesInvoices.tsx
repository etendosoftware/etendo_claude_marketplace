import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, s, b64, formatCurrency, AuthProps, authHeader, apiFetch, SkeletonRow, PageHeader, ErrorBanner, StatusBadge } from '../../styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface SalesInvoice {
  id: string
  documentNo: string
  status: string
  customerId: string
  customer?: string
  grandTotal: number
  currency: string
  invoiceDate: string
}

// ── Sales Invoices Page ───────────────────────────────────────────────────────

export default function SalesInvoices({ apiBase = '/lite', tenantId, username, password, token }: AuthProps) {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const headers = { Authorization: authHeader({ token, username, password, apiBase, tenantId }), 'X-Tenant-ID': tenantId }
    setLoading(true)
    apiFetch(`${apiBase}/sales/invoices`, { headers })
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
        title="Sales Invoices"
        subtitle={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
        action={
          <button
            style={s.btnPrimary}
            onClick={() => navigate('/sales/invoices/new')}
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
              <th style={s.th}>Customer</th>
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
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span style={{ fontSize: 14 }}>No sales invoices found.</span>
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((inv, idx) => (
                <tr
                  key={inv.id}
                  style={{ background: idx % 2 === 1 ? C.stripedRow : '#fff' }}
                >
                  <td style={s.td}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.primary,
                    }}>
                      {inv.documentNo}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize: 13, color: C.textBody }}>{formatDate(inv.invoiceDate)}</span>
                  </td>
                  <td style={s.td}>
                    <span style={{ fontWeight: 500, color: C.textDark }}>
                      {inv.customer ?? inv.customerId}
                    </span>
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
