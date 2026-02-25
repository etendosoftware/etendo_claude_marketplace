import { useState, useEffect } from 'react'
import { C, s, b64, formatCurrency, Spinner, AuthProps, authHeader, apiFetch } from '../styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  payable: {
    total: number
    count: number
    currency: string
  }
  receivable: {
    total: number
    count: number
    currency: string
    available: boolean
  }
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  subtitle,
  color,
  icon,
  badge,
}: {
  title: string
  value: string
  subtitle: string
  color: string
  icon: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div style={{
      ...s.card,
      padding: '24px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        {badge}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.textDark, letterSpacing: '-0.5px', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ ...s.card, padding: '24px 28px' }}>
      <div style={{ display: 'flex', gap: 16, flexDirection: 'column' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s infinite',
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            height: 11, width: '40%', borderRadius: 6,
            background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }} />
          <div style={{
            height: 28, width: '65%', borderRadius: 6,
            background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }} />
          <div style={{
            height: 13, width: '50%', borderRadius: 6,
            background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }} />
        </div>
      </div>
    </div>
  )
}

// ── Not Configured Badge ──────────────────────────────────────────────────────

function NotConfiguredBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      background: C.warningBg,
      border: `1px solid ${C.warningBorder}`,
      color: C.warning,
      letterSpacing: '0.02em',
      flexShrink: 0,
    }}>
      Not configured
    </span>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({ apiBase = '/lite', tenantId, username, password, token }: AuthProps) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const headers = { Authorization: authHeader({ token, username, password, apiBase, tenantId }), 'X-Tenant-ID': tenantId }
    setLoading(true)
    apiFetch(`${apiBase}/payables/summary`, { headers })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => setSummary(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, tenantId, username, password, token])

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textDark, letterSpacing: '-0.4px', margin: '0 0 4px' }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>
          Financial overview for your business
        </p>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div style={{
          ...s.card,
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
          borderColor: C.dangerBorder,
          background: C.dangerBg,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: C.danger,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: C.danger, fontSize: 14 }}>Could not load summary</div>
            <div style={{ fontSize: 13, color: C.danger, opacity: 0.8, marginTop: 2 }}>{error}</div>
          </div>
        </div>
      )}

      {/* Metric cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : summary ? (
          <>
            {/* Receivables */}
            <MetricCard
              title="Receivables"
              value={summary.receivable.available
                ? formatCurrency(summary.receivable.total, summary.receivable.currency)
                : '—'
              }
              subtitle={summary.receivable.available
                ? `${summary.receivable.count} open invoice${summary.receivable.count !== 1 ? 's' : ''}`
                : 'Sales invoice module not configured'
              }
              color={C.primary}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              }
              badge={!summary.receivable.available ? <NotConfiguredBadge /> : undefined}
            />

            {/* Payables */}
            <MetricCard
              title="Payables"
              value={formatCurrency(summary.payable.total, summary.payable.currency)}
              subtitle={`${summary.payable.count} open invoice${summary.payable.count !== 1 ? 's' : ''}`}
              color={C.warning}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              }
            />

            {/* Placeholder: Sales Orders */}
            <MetricCard
              title="Sales Orders"
              value="—"
              subtitle="Connect sales orders module"
              color={C.success}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              }
              badge={<NotConfiguredBadge />}
            />

            {/* Placeholder: Products */}
            <MetricCard
              title="Active Products"
              value="—"
              subtitle="Product catalog overview"
              color={C.textMuted}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                </svg>
              }
              badge={<NotConfiguredBadge />}
            />
          </>
        ) : null}
      </div>

      {/* Quick actions */}
      <div style={{ ...s.card, padding: '24px 28px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: '0 0 16px' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'New Sales Order', path: '/sales/orders', color: C.primary },
            { label: 'View Customers',  path: '/customers',   color: C.textMuted },
            { label: 'View Vendors',    path: '/vendors',     color: C.textMuted },
            { label: 'View Products',   path: '/products',    color: C.textMuted },
          ].map(item => (
            <a
              key={item.label}
              href={item.path}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: item.color === C.primary ? C.primary : C.bg,
                color: item.color === C.primary ? '#fff' : C.textBody,
                border: `1px solid ${item.color === C.primary ? C.primary : C.border}`,
                textDecoration: 'none',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

    </div>
  )
}
