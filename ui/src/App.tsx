import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'

import { C, injectGlobalCSS, AuthProps } from './styles'
import Login from './pages/Login'

// Pages
import Dashboard from './pages/Dashboard'
import Customers from './pages/masters/Customers'
import Vendors from './pages/masters/Vendors'
import Products from './pages/masters/Products'
import SalesOrders from './pages/sales/SalesOrders'
import CreateSalesOrder from './pages/sales/CreateSalesOrder'
import SalesInvoices from './pages/sales/SalesInvoices'
import CreateSalesInvoice from './pages/sales/CreateSalesInvoice'
import PurchaseInvoices from './pages/purchases/PurchaseInvoices'
import CreatePurchaseInvoice from './pages/purchases/CreatePurchaseInvoice'

// ── SVG icons (inline) ────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function IconTrendingUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconFileText() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconShoppingBag() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

function IconBox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconTruck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
}

// ── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType
  group?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',         path: '/',                icon: IconGrid      },
  { label: 'Customers',         path: '/customers',       icon: IconUsers,      group: 'Masters'   },
  { label: 'Vendors',           path: '/vendors',         icon: IconTruck,      group: 'Masters'   },
  { label: 'Products',          path: '/products',        icon: IconBox,        group: 'Masters'   },
  { label: 'Sales Orders',      path: '/sales/orders',    icon: IconTrendingUp, group: 'Sales'     },
  { label: 'Sales Invoices',    path: '/sales/invoices',  icon: IconFileText,   group: 'Sales'     },
  { label: 'Purchase Invoices', path: '/purchases',       icon: IconShoppingBag,group: 'Purchases' },
]

// ── Sidebar item ──────────────────────────────────────────────────────────────

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      to={item.path}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 8,
        marginBottom: 2,
        cursor: 'pointer',
        background: active ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
        color: active ? '#818cf8' : 'rgba(255,255,255,0.5)',
        transition: 'background 0.15s ease, color 0.15s ease',
        position: 'relative',
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)'
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'
        }
      }}
    >
      {active && (
        <div style={{
          position: 'absolute',
          left: 0, top: '20%', bottom: '20%',
          width: 3,
          background: '#4f46e5',
          borderRadius: '0 2px 2px 0',
        }} />
      )}
      <Icon />
      <span style={{ fontSize: 14, fontWeight: active ? 600 : 400 }}>
        {item.label}
      </span>
    </Link>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const location = useLocation()

  // Group items
  const groups: Record<string, NavItem[]> = {}
  const topItems: NavItem[] = []

  for (const item of NAV_ITEMS) {
    if (!item.group) {
      topItems.push(item)
    } else {
      if (!groups[item.group]) groups[item.group] = []
      groups[item.group].push(item)
    }
  }

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <aside style={{
      width: 220,
      minHeight: '100vh',
      background: C.sidebar,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
    }}>

      {/* Logo */}
      <div style={{
        padding: '28px 24px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>
              Etendo
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>
              demo tenant
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>

        {/* Top items (Dashboard) */}
        {topItems.map(item => (
          <SidebarItem key={item.path} item={item} active={isActive(item.path)} />
        ))}

        {/* Groups */}
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 600,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '0 12px',
              marginBottom: 6,
            }}>
              {groupName}
            </div>
            {items.map(item => (
              <SidebarItem key={item.path} item={item} active={isActive(item.path)} />
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '16px 12px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 8,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
            flexShrink: 0,
          }}>
            A
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>Admin</div>
          </div>
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

// ── App shell ─────────────────────────────────────────────────────────────────

function AppShell() {
  const [auth, setAuth] = useState<AuthProps | null>(() => {
    const token    = localStorage.getItem('etendo_token')
    const tenantId = localStorage.getItem('etendo_tenant')
    if (token && tenantId) return { apiBase: '/lite', tenantId, token }
    return null
  })

  useEffect(() => {
    injectGlobalCSS()
    const onLogoutEvent = () => setAuth(null)
    window.addEventListener('etendo:logout', onLogoutEvent)
    return () => window.removeEventListener('etendo:logout', onLogoutEvent)
  }, [])

  function handleLogin(token: string, tenantId: string) {
    localStorage.setItem('etendo_token', token)
    localStorage.setItem('etendo_tenant', tenantId)
    setAuth({ apiBase: '/lite', tenantId, token })
  }

  function handleLogout() {
    localStorage.removeItem('etendo_token')
    localStorage.removeItem('etendo_tenant')
    setAuth(null)
  }

  if (!auth) return <Login onLogin={handleLogin} />

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      minHeight: '100vh',
      display: 'flex',
      background: C.bg,
    }}>
      <Sidebar onLogout={handleLogout} />

      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <Routes>
          <Route path="/"                  element={<Dashboard        {...auth} />} />
          <Route path="/customers"         element={<Customers        {...auth} />} />
          <Route path="/vendors"           element={<Vendors          {...auth} />} />
          <Route path="/products"          element={<Products         {...auth} />} />
          <Route path="/sales/orders"      element={<SalesOrders      {...auth} />} />
          <Route path="/sales/orders/new"  element={<CreateSalesOrder {...auth} />} />
          <Route path="/sales/invoices"      element={<SalesInvoices        {...auth} />} />
          <Route path="/sales/invoices/new" element={<CreateSalesInvoice  {...auth} />} />
          <Route path="/purchases"          element={<PurchaseInvoices     {...auth} />} />
          <Route path="/purchases/new"      element={<CreatePurchaseInvoice {...auth} />} />

          {/* 404 */}
          <Route path="*" element={
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', minHeight: '60vh',
              color: C.textMuted, gap: 12,
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.textDark }}>Page not found</div>
              <Link to="/" style={{ fontSize: 14, color: C.primary, textDecoration: 'none' }}>
                Back to Dashboard
              </Link>
            </div>
          } />
        </Routes>
      </main>
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
