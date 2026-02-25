import { useState, useEffect } from 'react'
import { C, s, formatCurrency, AuthProps, apiFetch, Spinner, SkeletonRow, PageHeader, ErrorBanner } from '../../styles'

// ── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  code: string
  uOM?: string
  unitPrice?: number
}

interface Price {
  id: string
  priceListVersion: string
  priceListName?: string
  listPrice: number
  standardPrice: number
}

interface PriceList {
  id: string
  name: string
}

// ── New Product Panel ─────────────────────────────────────────────────────────

function NewProductPanel({
  apiBase, tenantId, token,
  onCreated, onClose,
}: Pick<AuthProps, 'apiBase' | 'tenantId' | 'token'> & { onCreated: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', searchKey: '' })
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
      const res = await apiFetch(`${apiBase}/masters/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
        body: JSON.stringify({ name: form.name.trim(), searchKey: form.searchKey.trim() || undefined }),
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
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.textDark, margin: 0 }}>New Product</h3>
        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, display: 'flex' }} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={s.label}>Name <span style={{ color: C.danger }}>*</span></label>
            <input style={s.input} placeholder="Product name" value={form.name} onChange={e => set('name', e.target.value)}
              onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
              onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }} autoFocus />
          </div>
          <div>
            <label style={s.label}>Search Key</label>
            <input style={s.input} placeholder="Short code (optional)" value={form.searchKey} onChange={e => set('searchKey', e.target.value)}
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
            {submitting ? <><Spinner size={14} color="rgba(255,255,255,0.8)" /> Saving...</> : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Inline price editor for a single price list row ──────────────────────────

function PriceRow({
  apiBase, tenantId, token, productId, priceList, price,
  onSaved,
}: Pick<AuthProps, 'apiBase' | 'tenantId' | 'token'> & {
  productId: string
  priceList: PriceList
  price?: Price
  onSaved: () => void
}) {
  const [editing, setEditing]       = useState(false)
  const [listPrice, setListPrice]   = useState(String(price?.listPrice ?? ''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const lp = parseFloat(listPrice)
    if (isNaN(lp) || lp < 0) return setError('Enter a valid price.')
    setError(null)
    setSubmitting(true)
    try {
      const res = await apiFetch(`${apiBase}/masters/products/${productId}/price`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
        body: JSON.stringify({ priceListVersion: priceList.id, listPrice: lp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setEditing(false)
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 2 }}>{priceList.name}</div>
        {!editing && (
          price
            ? <span style={{ fontWeight: 700, color: C.primary, fontSize: 16 }}>{formatCurrency(price.listPrice)}</span>
            : <span style={{ color: C.textPlaceholder, fontSize: 13, fontStyle: 'italic' }}>No price</span>
        )}
        {editing && error && <div style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>{error}</div>}
      </div>

      {editing ? (
        <form onSubmit={save} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number" min={0} step={0.01} autoFocus
            style={{ ...s.input, width: 120, height: 34, textAlign: 'right', fontSize: 13 }}
            value={listPrice}
            onChange={e => setListPrice(e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.boxShadow = C.primaryRing }}
            onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}
          />
          <button type="submit" style={{ ...s.btnPrimary, padding: '0 12px', height: 34, fontSize: 12, opacity: submitting ? 0.75 : 1 }} disabled={submitting}
            onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}>
            {submitting ? <Spinner size={12} color="rgba(255,255,255,0.8)" /> : 'Save'}
          </button>
          <button type="button" style={{ ...s.btnSecondary, padding: '0 10px', height: 34, fontSize: 12 }}
            onClick={() => { setEditing(false); setListPrice(String(price?.listPrice ?? '')); setError(null) }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}>
            ✕
          </button>
        </form>
      ) : (
        <button
          style={{ ...s.btnSecondary, padding: '4px 12px', fontSize: 12 }}
          onClick={() => { setListPrice(String(price?.listPrice ?? '')); setEditing(true) }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.bg }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
        >
          {price ? 'Edit' : '+ Set'}
        </button>
      )}
    </div>
  )
}

// ── Product Detail Drawer ─────────────────────────────────────────────────────

function ProductDetail({
  apiBase, tenantId, token, product, onClose,
}: Pick<AuthProps, 'apiBase' | 'tenantId' | 'token'> & { product: Product; onClose: () => void }) {
  const [prices, setPrices]         = useState<Price[]>([])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      apiFetch(`${apiBase}/masters/products/${product.id}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
      }).then(r => r.json()),
      apiFetch(`${apiBase}/masters/pricelists`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
      }).then(r => r.json()),
    ])
      .then(([prod, lists]) => {
        setPrices(prod.prices ?? [])
        setPriceLists(Array.isArray(lists) ? lists : [])
        setError(null)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [product.id])

  // Map priceListVersion id → price record
  const priceByVersion = Object.fromEntries(prices.map(p => [p.priceListVersion, p]))

  return (
    <tr>
      <td colSpan={4} style={{ padding: 0, background: C.bg }}>
        <div style={{ padding: '16px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: C.textDark, fontSize: 14 }}>{product.name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>{product.code}</div>
              </div>
            </div>
            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, display: 'flex' }} onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
            </button>
          </div>

          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Pricing by Price List
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted, fontSize: 13 }}>
              <Spinner size={14} color={C.textMuted} /> Loading...
            </div>
          ) : priceLists.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 13, fontStyle: 'italic' }}>No price lists configured.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 520 }}>
              {priceLists.map(pl => (
                <PriceRow
                  key={pl.id}
                  apiBase={apiBase} tenantId={tenantId} token={token}
                  productId={product.id}
                  priceList={pl}
                  price={priceByVersion[pl.id]}
                  onSaved={load}
                />
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Products Page ─────────────────────────────────────────────────────────────

export default function Products({ apiBase = '/lite', tenantId, token }: AuthProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  function load() {
    setLoading(true)
    apiFetch(`${apiBase}/masters/products`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId },
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setProducts(Array.isArray(d) ? d : []); setError(null) })
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
        title="Products"
        subtitle={`${products.length} product${products.length !== 1 ? 's' : ''} in catalog`}
        action={
          <button style={s.btnPrimary} onClick={() => setShowPanel(v => !v)}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primary }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Product
          </button>
        }
      />

      {showPanel && (
        <NewProductPanel
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
              <th style={{ ...s.th, textAlign: 'right' }}>List Price</th>
              <th style={{ ...s.th, width: 80, textAlign: 'center' }}>Pricing</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
              </>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ ...s.td, textAlign: 'center', padding: '48px 16px', color: C.textMuted }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                    </svg>
                    <span style={{ fontSize: 14 }}>No products yet. Create your first one.</span>
                  </div>
                </td>
              </tr>
            ) : (
              products.flatMap((p, idx) => {
                const isOpen = expanded === p.id
                const rows = [
                  <tr
                    key={p.id}
                    onClick={() => toggleExpanded(p.id)}
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
                        <span style={{ fontWeight: 500, color: C.textDark }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 500, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '2px 8px', color: C.textMuted }}>
                        {p.code}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      {(p.unitPrice ?? 0) > 0 ? (
                        <span style={{ fontWeight: 600, color: C.primary, fontSize: 14 }}>{formatCurrency(p.unitPrice!)}</span>
                      ) : (
                        <span style={{ color: C.textPlaceholder, fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); toggleExpanded(p.id) }}
                        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', color: C.primary, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.primaryLight }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                      >
                        {isOpen ? 'Close' : 'Price'}
                      </button>
                    </td>
                  </tr>,
                ]
                if (isOpen) {
                  rows.push(
                    <ProductDetail
                      key={`${p.id}-detail`}
                      apiBase={apiBase} tenantId={tenantId} token={token}
                      product={p}
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
