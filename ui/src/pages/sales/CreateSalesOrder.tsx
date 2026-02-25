/**
 * CreateSalesOrder.tsx
 *
 * Self-contained React component for creating a sales order in Etendo Lite.
 * Shows only: customer search + date + product lines (search + qty).
 * Everything else (pricing, tax, document numbers) is handled server-side.
 *
 * API calls:
 *   GET /lite/masters/customers         → all customers
 *   GET /lite/masters/products?priceListId=xx → products for price list
 *   POST /lite/sales/orders             → create + complete order
 */

import { useState, useEffect } from 'react'
import { C, s, b64, today, formatCurrency, Spinner, AuthProps, authHeader, apiFetch, ErrorBanner } from '../../styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  id: string
  name: string
  code: string
  priceListId?: string
  category?: string
  creditUsed?: number
  creditLimit?: number
  creditStatus?: string
}

interface Product {
  id: string
  name: string
  unitPrice: number
}

interface Line {
  id: string
  product: Product | null
  productSearch: string
  quantity: number
}

interface OrderResult {
  orderId: string
  documentNo: string
  status: string
  _completing?: boolean
  _completed?: boolean
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── CustomerSearch ────────────────────────────────────────────────────────────

function CustomerSearch({
  apiBase, tenantId, username, password, token,
  value, onChange,
}: AuthProps & {
  value: Customer | null
  onChange: (c: Customer | null) => void
}) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const headers = { Authorization: authHeader({ token, username, password, apiBase, tenantId }), 'X-Tenant-ID': tenantId }

  useEffect(() => {
    setLoading(true)
    apiFetch(`${apiBase}/masters/customers`, { headers })
      .then(r => r.json())
      .then(d => setAllCustomers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, tenantId, username, password, token])

  const filtered = query.trim().length === 0
    ? allCustomers
    : allCustomers.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.code?.toLowerCase().includes(query.toLowerCase())
      )

  const inputStyle: React.CSSProperties = {
    ...s.input,
    paddingRight: 40,
    borderColor: focused ? C.primary : (value ? C.success : C.inputBorder),
    boxShadow: focused ? C.primaryRing : 'none',
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder={loading ? 'Loading customers…' : 'Search by name or code…'}
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          if (value) onChange(null)
          setOpen(true)
        }}
        onFocus={() => { setFocused(true); setOpen(true) }}
        onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150) }}
      />

      <div style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', alignItems: 'center',
      }}>
        {loading && <Spinner size={14} />}
        {!loading && value && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setQuery(''); onChange(null) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: C.textMuted, display: 'flex', alignItems: 'center', borderRadius: 4,
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.danger }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.textMuted }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div style={s.dropdown}>
          {filtered.slice(0, 30).map((c, idx) => (
            <CustomerDropdownItem
              key={c.id}
              customer={c}
              selected={value?.id === c.id}
              striped={idx % 2 === 1}
              onSelect={() => {
                setQuery(c.name)
                onChange(c)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerDropdownItem({
  customer, striped, selected, onSelect,
}: { customer: Customer; striped: boolean; selected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        padding: '10px 14px',
        cursor: 'pointer',
        background: hovered ? C.primaryLight : (selected ? C.primaryLight : (striped ? C.stripedRow : '#fff')),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 0.1s ease',
        borderBottom: `1px solid ${C.border}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onSelect}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark }}>{customer.name}</div>
        {customer.category && (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{customer.category}</div>
        )}
      </div>
      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: C.textMuted,
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: '2px 8px',
        flexShrink: 0,
        marginLeft: 12,
        fontFamily: 'monospace',
      }}>
        {customer.code}
      </span>
    </div>
  )
}

// ── ProductSearch ─────────────────────────────────────────────────────────────

function ProductSearch({
  apiBase, tenantId, username, password, token,
  priceListId, value, onChange,
}: AuthProps & {
  priceListId?: string
  value: Product | null
  onChange: (p: Product | null) => void
}) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const headers = { Authorization: authHeader({ token, username, password, apiBase, tenantId }), 'X-Tenant-ID': tenantId }

  useEffect(() => {
    setLoading(true)
    const qs = priceListId ? new URLSearchParams({ priceListId }).toString() : ''
    apiFetch(`${apiBase}/masters/products${qs ? '?' + qs : ''}`, { headers })
      .then(r => r.json())
      .then(d => setAllProducts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, tenantId, username, password, token, priceListId])

  const filtered = query.trim().length === 0
    ? allProducts
    : allProducts.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))

  const inputStyle: React.CSSProperties = {
    ...s.input,
    height: 36,
    fontSize: 13,
    borderColor: focused ? C.primary : C.inputBorder,
    boxShadow: focused ? C.primaryRing : 'none',
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        placeholder={loading ? 'Loading…' : 'Search product…'}
        disabled={false}
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          if (value) onChange(null)
          setOpen(true)
        }}
        onFocus={() => { setFocused(true); setOpen(true) }}
        onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150) }}
      />
      {!loading && value && (
        <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setQuery(''); onChange(null) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 3,
              color: C.textMuted, display: 'flex', alignItems: 'center', borderRadius: 4,
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.danger }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.textMuted }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      {open && filtered.length > 0 && (
        <div style={s.dropdown}>
          {filtered.slice(0, 30).map((p, idx) => (
            <ProductDropdownItem
              key={p.id}
              product={p}
              selected={value?.id === p.id}
              striped={idx % 2 === 1}
              onSelect={() => {
                setQuery(p.name)
                onChange(p)
                setOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductDropdownItem({
  product, striped, selected, onSelect,
}: { product: Product; striped: boolean; selected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        padding: '9px 14px',
        cursor: 'pointer',
        background: hovered ? C.primaryLight : (selected ? C.primaryLight : (striped ? C.stripedRow : '#fff')),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 0.1s ease',
        borderBottom: `1px solid ${C.border}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onSelect}
    >
      <span style={{ fontSize: 13, color: C.textDark, fontWeight: 500 }}>{product.name}</span>
      {product.unitPrice > 0 && (
        <span style={{ fontSize: 12, fontWeight: 600, color: C.primary, marginLeft: 12, flexShrink: 0 }}>
          {formatCurrency(product.unitPrice)}
        </span>
      )}
    </div>
  )
}

// ── QuantityStepper ───────────────────────────────────────────────────────────

function QuantityStepper({
  value, onChange,
}: { value: number; onChange: (n: number) => void }) {
  const btnStyle: React.CSSProperties = {
    width: 28, height: 28,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: '#fff',
    color: C.textBody,
    fontSize: 16,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 1,
    transition: 'background 0.1s ease, border-color 0.1s ease',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" style={btnStyle}
        onClick={() => onChange(Math.max(1, value - 1))}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
      >−</button>
      <span style={{ minWidth: 32, textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.textDark }}>
        {value}
      </span>
      <button type="button" style={btnStyle}
        onClick={() => onChange(value + 1)}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
      >+</button>
    </div>
  )
}

// ── CreditBadge ───────────────────────────────────────────────────────────────

function CreditBadge({ status }: { status?: string }) {
  if (!status) return null
  const isOver    = status === 'O'
  const isWarning = status === 'W'
  const bg     = isOver ? C.dangerBg    : isWarning ? C.warningBg    : C.successBg
  const border = isOver ? C.dangerBorder: isWarning ? C.warningBorder: C.successBorder
  const color  = isOver ? C.danger      : isWarning ? C.warning      : C.success
  const label  = isOver ? 'Over Limit'  : isWarning ? 'Near Limit'   : 'Good Standing'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: bg, border: `1px solid ${border}`, color,
      letterSpacing: '0.02em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── CustomerInfoCard ──────────────────────────────────────────────────────────

function CustomerInfoCard({ customer }: { customer: Customer }) {
  const hasCredit = typeof customer.creditUsed === 'number'
  const usedPct   = hasCredit && customer.creditLimit
    ? Math.min(100, (customer.creditUsed! / customer.creditLimit) * 100)
    : 0
  const progressColor = customer.creditStatus === 'O' ? C.danger
    : customer.creditStatus === 'W' ? C.warning : C.success

  return (
    <div style={{
      ...s.card,
      padding: '16px 20px',
      marginTop: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      flexWrap: 'wrap' as const,
      animation: 'dropIn 0.2s ease',
    }}>
      {customer.category && (
        <div>
          <div style={s.label}>Category</div>
          <span style={{
            background: C.primaryLight,
            color: C.primary,
            border: `1px solid rgba(79,70,229,0.2)`,
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 600,
          }}>
            {customer.category}
          </span>
        </div>
      )}
      <div>
        <div style={s.label}>Code</div>
        <span style={{
          fontSize: 13, fontWeight: 600, color: C.textBody,
          fontFamily: 'monospace', background: C.bg,
          border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '3px 10px', display: 'inline-block',
        }}>
          {customer.code}
        </span>
      </div>
      {hasCredit && (
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={s.label}>Credit</span>
            <CreditBadge status={customer.creditStatus} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${customer.creditLimit ? usedPct : 0}%`,
                background: progressColor,
                borderRadius: 999,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
              {formatCurrency(customer.creditUsed ?? 0)}
              {customer.creditLimit ? ` / ${formatCurrency(customer.creditLimit)}` : '  (no limit)'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CreateSalesOrder({
  apiBase = '/lite',
  tenantId,
  username,
  password,
  token,
}: AuthProps) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orderDate, setOrderDate] = useState(today())
  const [lines, setLines] = useState<Line[]>([{ id: uid(), product: null, productSearch: '', quantity: 1 }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OrderResult | null>(null)

  const priceListId = customer?.priceListId

  function addLine() {
    setLines(prev => [...prev, { id: uid(), product: null, productSearch: '', quantity: 1 }])
  }
  function removeLine(id: string) {
    setLines(prev => prev.filter(l => l.id !== id))
  }
  function updateLine(id: string, patch: Partial<Line>) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  const orderTotal = lines.reduce((sum, l) => {
    if (l.product && l.product.unitPrice > 0) return sum + l.product.unitPrice * l.quantity
    return sum
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!customer) return setError('Please select a customer.')
    const validLines = lines.filter(l => l.product && l.quantity > 0)
    if (!validLines.length) return setError('Add at least one product line.')

    setSubmitting(true)
    try {
      const res = await apiFetch(`${apiBase}/sales/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader({ token, username, password, apiBase, tenantId }),
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({
          customerId: customer.id,
          date: orderDate,
          lines: validLines.map(l => ({ productId: l.product!.id, quantity: l.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setResult(null)
    setCustomer(null)
    setOrderDate(today())
    setLines([{ id: uid(), product: null, productSearch: '', quantity: 1 }])
    setError(null)
  }

  async function handleComplete() {
    if (!result) return
    setResult(r => r ? { ...r, _completing: true } : r)
    setError(null)
    try {
      const res = await apiFetch(`${apiBase}/sales/orders/${result.orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader({ token, username, password, apiBase, tenantId }),
          'X-Tenant-ID': tenantId,
        },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult(r => r ? { ...r, status: 'CO', _completing: false, _completed: true } : r)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setResult(r => r ? { ...r, _completing: false } : r)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (result) {
    const isCompleted = result.status === 'CO' || result._completed
    const isCompleting = result._completing

    return (
      <div style={{ padding: '48px 40px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{
          ...s.card,
          padding: '48px 40px',
          textAlign: 'center',
          animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: isCompleted ? C.successBg : C.warningBg,
            border: `2px solid ${isCompleted ? C.successBorder : C.warningBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
          }}>
            {isCompleted ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            )}
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.textDark, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
            {isCompleted ? 'Order Confirmed' : 'Draft Saved'}
          </h2>
          <p style={{ color: C.textMuted, fontSize: 14, margin: '0 0 28px' }}>
            {isCompleted
              ? 'The order has been confirmed and is now read-only.'
              : 'The order was saved as a draft. You can complete it from the orders list or below.'}
          </p>

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <div style={{
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '16px 20px', marginBottom: 28, textAlign: 'left',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={s.label}>Order Number</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.primary, letterSpacing: '-0.3px' }}>
                #{result.documentNo}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>Customer</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{customer?.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>Date</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.textBody }}>
                {new Date(orderDate + 'T00:00:00').toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>Status</span>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                padding: '3px 10px', borderRadius: 999,
                background: isCompleted ? C.successBg : C.warningBg,
                color: isCompleted ? C.success : C.warning,
                border: `1px solid ${isCompleted ? C.successBorder : C.warningBorder}`,
              }}>
                {isCompleted ? 'CONFIRMED' : 'DRAFT'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={s.btnSecondary} onClick={resetForm}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
            >
              New Order
            </button>
            {!isCompleted && (
              <button
                onClick={handleComplete}
                disabled={!!isCompleting}
                style={{
                  ...s.btnPrimary,
                  background: C.success,
                  opacity: isCompleting ? 0.75 : 1,
                  cursor: isCompleting ? 'wait' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => { if (!isCompleting) (e.currentTarget as HTMLButtonElement).style.background = '#059669' }}
                onMouseLeave={e => { if (!isCompleting) (e.currentTarget as HTMLButtonElement).style.background = C.success }}
              >
                {isCompleting ? (
                  <><Spinner size={14} color="rgba(255,255,255,0.8)" /> Completing…</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Complete Order
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900, margin: '0 auto' }}>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span style={{ fontSize: 13, color: C.textMuted }}>
            <span style={{ cursor: 'pointer', color: C.textMuted }}>Sales</span>
            <span style={{ margin: '0 6px', color: C.border }}>/</span>
            <span style={{ color: C.textBody, fontWeight: 500 }}>New Order</span>
          </span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.textDark, letterSpacing: '-0.4px', margin: 0 }}>
          New Sales Order
        </h1>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit}>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 16,
          marginBottom: 16,
          alignItems: 'start',
        }}>
          <div style={{ ...s.card, padding: '20px 24px' }}>
            <label style={s.label}>Customer</label>
            <CustomerSearch
              apiBase={apiBase} tenantId={tenantId}
              username={username} password={password} token={token}
              value={customer} onChange={setCustomer}
            />
            {customer && <CustomerInfoCard customer={customer} />}
          </div>

          <div style={{ ...s.card, padding: '20px 24px' }}>
            <label style={s.label}>Order Date</label>
            <input
              type="date"
              style={s.input}
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              {['Today', 'Tomorrow'].map((label, i) => {
                const d = new Date()
                d.setDate(d.getDate() + i)
                const val = d.toISOString().split('T')[0]
                const isActive = orderDate === val
                return (
                  <button
                    key={label} type="button"
                    style={{
                      background: isActive ? C.primaryLight : C.bg,
                      border: `1px solid ${isActive ? C.primary : C.border}`,
                      color: isActive ? C.primary : C.textMuted,
                      borderRadius: 6, padding: '4px 10px',
                      fontSize: 12, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.1s ease',
                    }}
                    onClick={() => setOrderDate(val)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: 0 }}>Order Lines</h3>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              {lines.filter(l => l.product).length} / {lines.length} products added
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: '40%' }}>#</th>
                <th style={{ ...s.th, width: '12%', textAlign: 'center' as const }}>Qty</th>
                <th style={{ ...s.th, width: '14%', textAlign: 'right' as const }}>Unit Price</th>
                <th style={{ ...s.th, width: '14%', textAlign: 'right' as const }}>Subtotal</th>
                <th style={{ ...s.th, width: '6%' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const unitPrice = line.product?.unitPrice ?? 0
                const subtotal  = unitPrice * line.quantity
                const isStriped = idx % 2 === 1
                return (
                  <tr key={line.id} style={{ background: isStriped ? C.stripedRow : '#fff' }}>
                    <td style={{ ...s.td, width: '40%' }}>
                      <ProductSearch
                        apiBase={apiBase} tenantId={tenantId}
                        username={username} password={password} token={token}
                        priceListId={priceListId}
                        value={line.product}
                        onChange={p => updateLine(line.id, { product: p })}
                      />
                    </td>
                    <td style={{ ...s.td, width: '12%', textAlign: 'center' as const }}>
                      <QuantityStepper value={line.quantity} onChange={n => updateLine(line.id, { quantity: n })} />
                    </td>
                    <td style={{ ...s.td, width: '14%', textAlign: 'right' as const }}>
                      {unitPrice > 0 ? (
                        <span style={{ fontSize: 13, color: C.textBody, fontWeight: 500 }}>{formatCurrency(unitPrice)}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: C.textPlaceholder }}>—</span>
                      )}
                    </td>
                    <td style={{ ...s.td, width: '14%', textAlign: 'right' as const }}>
                      {subtotal > 0 ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{formatCurrency(subtotal)}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: C.textPlaceholder }}>—</span>
                      )}
                    </td>
                    <td style={{ ...s.td, width: '6%', textAlign: 'center' as const }}>
                      <button
                        type="button"
                        style={{
                          background: 'none', border: 'none',
                          cursor: lines.length === 1 ? 'not-allowed' : 'pointer',
                          opacity: lines.length === 1 ? 0.25 : 0.45,
                          color: C.danger, padding: '4px',
                          display: 'flex', alignItems: 'center',
                          borderRadius: 6,
                          transition: 'opacity 0.1s ease, background 0.1s ease',
                        }}
                        disabled={lines.length === 1}
                        onClick={() => removeLine(line.id)}
                        onMouseEnter={e => {
                          if (lines.length > 1) {
                            (e.currentTarget as HTMLButtonElement).style.opacity = '1'
                            ;(e.currentTarget as HTMLButtonElement).style.background = C.dangerBg
                          }
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = lines.length === 1 ? '0.25' : '0.45'
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}` }}>
            <button
              type="button" style={s.btnGhost} onClick={addLine}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primaryLight }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add product
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <button type="button" style={s.btnSecondary} onClick={resetForm}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {orderTotal > 0 && (
              <div style={{ textAlign: 'right' as const }}>
                <div style={s.label}>Order Total</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.textDark, letterSpacing: '-0.5px' }}>
                  {formatCurrency(orderTotal)}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Excl. taxes</div>
              </div>
            )}

            <button
              type="submit"
              style={{
                ...s.btnPrimary,
                opacity: submitting ? 0.75 : 1,
                cursor: submitting ? 'wait' : 'pointer',
                minWidth: 160, height: 44, fontSize: 15,
              }}
              disabled={submitting}
              onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
            >
              {submitting ? (
                <><Spinner size={16} color="rgba(255,255,255,0.8)" /> Creating...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Confirm Order
                </>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}
