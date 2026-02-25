import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, s, formatCurrency, AuthProps, authHeader, apiFetch, Spinner, SkeletonRow, PageHeader, ErrorBanner, StatusBadge } from '../../styles'

interface SalesOrder {
  id: string
  documentNo: string
  orderDate: string
  customer: string
  customerId: string
  status: string
  grandTotal: number
  currency: string
}

export default function SalesOrders({ apiBase = '/lite', tenantId, username, password, token }: AuthProps) {
  const [orders, setOrders]       = useState<SalesOrder[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [completing, setCompleting] = useState<Set<string>>(new Set())
  const navigate = useNavigate()

  function load() {
    const headers = {
      Authorization: authHeader({ token, username, password, apiBase, tenantId }),
      'X-Tenant-ID': tenantId,
    }
    setLoading(true)
    apiFetch(`${apiBase}/sales/orders`, { headers })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setOrders(d.data ?? []); setError(null) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, tenantId, username, password, token])

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch { return dateStr }
  }

  async function completeOrder(orderId: string) {
    setCompleting(prev => new Set(prev).add(orderId))
    try {
      const res = await apiFetch(`${apiBase}/sales/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader({ token, username, password, apiBase, tenantId }),
          'X-Tenant-ID': tenantId,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCompleting(prev => { const s = new Set(prev); s.delete(orderId); return s })
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      <PageHeader
        title="Sales Orders"
        subtitle={loading ? '' : `${orders.length} order${orders.length !== 1 ? 's' : ''}`}
        action={
          <button
            style={s.btnPrimary}
            onClick={() => navigate('/sales/orders/new')}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Order
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
              <th style={{ ...s.th, width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow cols={6} />
                <SkeletonRow cols={6} />
                <SkeletonRow cols={6} />
                <SkeletonRow cols={6} />
                <SkeletonRow cols={6} />
              </>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...s.td, textAlign: 'center', padding: '48px 16px', color: C.textMuted }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                    <span style={{ fontSize: 14 }}>No sales orders found.</span>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order, idx) => {
                const isCompleting = completing.has(order.id)
                const isDraft = order.status === 'DR'
                return (
                  <tr key={order.id} style={{ background: idx % 2 === 1 ? C.stripedRow : '#fff' }}>
                    <td style={s.td}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: C.primary }}>
                        {order.documentNo}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontSize: 13, color: C.textBody }}>{formatDate(order.orderDate)}</span>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontWeight: 500, color: C.textDark }}>{order.customer || order.customerId}</span>
                    </td>
                    <td style={s.td}>
                      <StatusBadge status={order.status} />
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <span style={{ fontWeight: 600, color: C.textDark, fontSize: 14 }}>
                        {formatCurrency(order.grandTotal ?? 0, 'USD')}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      {isDraft && (
                        <button
                          onClick={() => completeOrder(order.id)}
                          disabled={isCompleting}
                          style={{
                            background: isCompleting ? C.successBg : C.success,
                            color: isCompleting ? C.success : '#fff',
                            border: `1px solid ${C.successBorder}`,
                            borderRadius: 6,
                            padding: '5px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: isCompleting ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontFamily: 'inherit',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { if (!isCompleting) (e.currentTarget as HTMLButtonElement).style.background = '#059669' }}
                          onMouseLeave={e => { if (!isCompleting) (e.currentTarget as HTMLButtonElement).style.background = C.success }}
                        >
                          {isCompleting ? (
                            <><Spinner size={11} color={C.success} /> Processing…</>
                          ) : (
                            <>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Complete
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
