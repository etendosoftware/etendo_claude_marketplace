/**
 * CreateSalesInvoice.tsx
 *
 * Form to create a sales invoice in Etendo Lite.
 * Customer search + date + product lines (search + qty + unit price).
 * Tax and UOM are resolved server-side automatically.
 *
 * API: POST /lite/sales/invoices
 *   Body: { customerId, date?, description?, lines: [{ productId, quantity, unitPrice }] }
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { C, s, today, formatCurrency, Spinner, AuthProps, authHeader, apiFetch, ErrorBanner } from '../../styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface Customer { id: string; name: string; code: string }
interface Product  { id: string; name: string; code: string }

interface Line {
  id: string
  product: Product | null
  productSearch: string
  quantity: number
  unitPrice: number
}

interface InvoiceResult {
  invoiceId: string
  documentNo: string
  status: string
}

function uid() { return Math.random().toString(36).slice(2) }

// ── CustomerSearch ────────────────────────────────────────────────────────────

function CustomerSearch({
  apiBase, tenantId, token,
  value, onChange,
}: Pick<AuthProps, 'apiBase' | 'tenantId' | 'token'> & {
  value: Customer | null
  onChange: (c: Customer | null) => void
}) {
  const [query, setQuery]     = useState(value?.name ?? '')
  const [results, setResults] = useState<Customer[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId }

  useEffect(() => {
    if (value) { setQuery(value.name); return }
    const t = setTimeout(async () => {
      if (!query.trim()) { setResults([]); return }
      setLoading(true)
      try {
        const r = await apiFetch(`${apiBase}/masters/customers/search?q=${encodeURIComponent(query)}`, { headers })
        setResults(r.ok ? await r.json() : [])
      } finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  function select(c: Customer) { onChange(c); setQuery(c.name); setOpen(false) }
  function clear() { onChange(null); setQuery(''); setResults([]); setOpen(false) }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...s.input, paddingRight: value ? 36 : 12 }}
          placeholder="Search customer..."
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(null); setOpen(true) }}
          onFocus={e => { setOpen(true); e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
          onBlur={e => { setTimeout(() => setOpen(false), 150); e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', padding: 2 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
        {loading && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <Spinner size={14} color={C.textMuted} />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,.1)', marginTop: 4, maxHeight: 220, overflowY: 'auto',
        }}>
          {results.map(c => (
            <div
              key={c.id}
              onMouseDown={() => select(c)}
              style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <span style={{ fontWeight: 500, color: C.textDark, fontSize: 13 }}>{c.name}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>{c.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ProductSearch ─────────────────────────────────────────────────────────────

function ProductSearch({
  apiBase, tenantId, token,
  value, searchText, onSearchChange, onSelect,
}: Pick<AuthProps, 'apiBase' | 'tenantId' | 'token'> & {
  value: Product | null
  searchText: string
  onSearchChange: (v: string) => void
  onSelect: (p: Product) => void
}) {
  const [results, setResults] = useState<Product[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId }

  useEffect(() => {
    if (value) return
    const t = setTimeout(async () => {
      if (!searchText.trim()) { setResults([]); return }
      setLoading(true)
      try {
        const r = await apiFetch(`${apiBase}/masters/products/search?q=${encodeURIComponent(searchText)}`, { headers })
        setResults(r.ok ? await r.json() : [])
      } finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [searchText])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...s.input, paddingRight: loading ? 36 : 12 }}
          placeholder="Search product..."
          value={searchText}
          onChange={e => { onSearchChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading && (
          <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <Spinner size={14} color={C.textMuted} />
          </div>
        )}
      </div>
      {open && results.length > 0 && !value && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,.1)', marginTop: 4, maxHeight: 200, overflowY: 'auto',
        }}>
          {results.map(p => (
            <div
              key={p.id}
              onMouseDown={() => { onSelect(p); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', gap: 10 }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <span style={{ fontWeight: 500, color: C.textDark, fontSize: 13 }}>{p.name}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>{p.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CreateSalesInvoice ────────────────────────────────────────────────────────

export default function CreateSalesInvoice({ apiBase = '/lite', tenantId, token }: AuthProps) {
  const navigate = useNavigate()

  const [customer, setCustomer]     = useState<Customer | null>(null)
  const [date, setDate]             = useState(today())
  const [description, setDescription] = useState('')
  const [lines, setLines]           = useState<Line[]>([{ id: uid(), product: null, productSearch: '', quantity: 1, unitPrice: 0 }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [result, setResult]         = useState<InvoiceResult | null>(null)

  function addLine() {
    setLines(prev => [...prev, { id: uid(), product: null, productSearch: '', quantity: 1, unitPrice: 0 }])
  }

  function removeLine(id: string) {
    setLines(prev => prev.filter(l => l.id !== id))
  }

  function updateLine(id: string, patch: Partial<Line>) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  const total = lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return setError('Please select a customer.')
    if (lines.some(l => !l.product)) return setError('All lines must have a product selected.')

    setError(null)
    setSubmitting(true)
    try {
      const r = await apiFetch(`${apiBase}/sales/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({
          customerId: customer.id,
          date,
          description: description.trim() || undefined,
          lines: lines.map(l => ({
            productId: l.product!.id,
            quantity:  l.quantity,
            unitPrice: l.unitPrice,
          })),
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`)
      setResult({ invoiceId: data.invoiceId, documentNo: data.documentNo, status: data.status })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (result) {
    return (
      <div style={{ padding: '32px 40px', maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.successBg, border: `1px solid ${C.successBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.textDark, margin: 0 }}>Invoice Created</h2>
        <div style={{ ...s.card, padding: '20px 28px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: C.primary, marginBottom: 8 }}>
            {result.documentNo}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted }}>Status: {result.status}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            style={s.btnSecondary}
            onClick={() => { setResult(null); setCustomer(null); setLines([{ id: uid(), product: null, productSearch: '', quantity: 1, unitPrice: 0 }]); setDescription('') }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
          >
            New Invoice
          </button>
          <button
            style={s.btnPrimary}
            onClick={() => navigate('/sales/invoices')}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
          >
            View All Invoices
          </button>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px 40px', maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          type="button"
          onClick={() => navigate('/sales/invoices')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', padding: 4, borderRadius: 6 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.textDark }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.textMuted }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.textDark, margin: 0 }}>New Sales Invoice</h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '2px 0 0' }}>Fill in the details and add product lines</p>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <form onSubmit={handleSubmit}>

        {/* Header fields */}
        <div style={{ ...s.card, padding: '24px 28px', marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>Invoice Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={s.label}>Customer <span style={{ color: C.danger }}>*</span></label>
              <CustomerSearch
                apiBase={apiBase} tenantId={tenantId} token={token}
                value={customer} onChange={setCustomer}
              />
            </div>
            <div>
              <label style={s.label}>Invoice Date</label>
              <input
                type="date"
                style={s.input}
                value={date}
                onChange={e => setDate(e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
                onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={s.label}>Description</label>
              <input
                style={s.input}
                placeholder="Optional description..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
                onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div style={{ ...s.card, padding: '24px 28px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Invoice Lines
            </h3>
            <button
              type="button"
              style={{ ...s.btnSecondary, padding: '6px 14px', fontSize: 12 }}
              onClick={addLine}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
            >
              + Add Line
            </button>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px 40px', gap: 10, marginBottom: 8, padding: '0 4px' }}>
            <span style={{ ...s.label, margin: 0 }}>Product</span>
            <span style={{ ...s.label, margin: 0 }}>Qty</span>
            <span style={{ ...s.label, margin: 0 }}>Unit Price</span>
            <span />
          </div>

          {lines.map((line, idx) => (
            <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px 40px', gap: 10, marginBottom: 10, alignItems: 'start' }}>
              {/* Product */}
              <ProductSearch
                apiBase={apiBase} tenantId={tenantId} token={token}
                value={line.product}
                searchText={line.productSearch}
                onSearchChange={v => updateLine(line.id, { productSearch: v, product: null })}
                onSelect={p => updateLine(line.id, { product: p, productSearch: p.name })}
              />

              {/* Quantity */}
              <input
                type="number"
                min={1}
                style={{ ...s.input, textAlign: 'right' }}
                value={line.quantity}
                onChange={e => updateLine(line.id, { quantity: Math.max(1, Number(e.target.value)) })}
                onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
                onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
              />

              {/* Unit Price */}
              <input
                type="number"
                min={0}
                step={0.01}
                style={{ ...s.input, textAlign: 'right' }}
                value={line.unitPrice}
                onChange={e => updateLine(line.id, { unitPrice: Math.max(0, Number(e.target.value)) })}
                onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
                onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
              />

              {/* Remove */}
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  style={{ height: 40, background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.danger; (e.currentTarget as HTMLButtonElement).style.borderColor = C.dangerBorder }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.textMuted; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
          ))}

          {/* Total */}
          {total > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Subtotal (net)</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{formatCurrency(total)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            style={s.btnSecondary}
            onClick={() => navigate('/sales/invoices')}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ ...s.btnPrimary, opacity: submitting ? 0.75 : 1, cursor: submitting ? 'wait' : 'pointer', minWidth: 140 }}
            disabled={submitting}
            onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
          >
            {submitting ? <><Spinner size={14} color="rgba(255,255,255,0.8)" /> Creating...</> : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}
